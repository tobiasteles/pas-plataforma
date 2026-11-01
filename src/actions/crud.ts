"use server";
import { createHash } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { limparContextos, sincronizarProvas } from "@/lib/provas";

export type FormState = { error?: string; ok?: string } | undefined;
type ItemType = "A" | "B" | "C" | "D";
type Stage = "PAS1" | "PAS2" | "PAS3";

const STAGES: Stage[] = ["PAS1", "PAS2", "PAS3"];
const TIPOS: ItemType[] = ["A", "B", "C", "D"];
const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ===================================================================== PROVAS */
function lerProva(fd: FormData) {
  const name = txt(fd, "name"), year = Number(txt(fd, "year")), stage = txt(fd, "stage") as Stage;
  if (!name || !Number.isInteger(year) || year < 1990 || year > 2100 || !STAGES.includes(stage)) return { error: "Preencha nome, ano (4 dígitos) e etapa." };
  return { name, year, stage, subprogram: txt(fd, "subprogram") || null, notes: txt(fd, "notes") || null };
}

export async function criarProva(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = lerProva(fd);
  if ("error" in p) return p;
  const [dup] = await db.select({ id: s.exams.id }).from(s.exams).where(eq(s.exams.name, p.name));
  if (dup) return { error: "Já existe uma prova com esse nome." };
  const [e] = await db.insert(s.exams).values(p).returning({ id: s.exams.id });
  revalidatePath("/admin/provas");
  redirect(`/admin/provas/${e.id}`);
}

/** Editar a prova atualiza também nome, ano, etapa e subprograma de todas as suas questões. */
export async function salvarProva(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(txt(fd, "id"));
  const p = lerProva(fd);
  if ("error" in p) return p;
  const [dup] = await db.select({ id: s.exams.id }).from(s.exams).where(and(eq(s.exams.name, p.name), ne(s.exams.id, id)));
  if (dup) return { error: "Outra prova já usa esse nome." };
  await db.update(s.exams).set(p).where(eq(s.exams.id, id));
  await db.update(s.questions).set({ examLabel: p.name, year: p.year, stage: p.stage, subprogram: p.subprogram }).where(eq(s.questions.examId, id));
  revalidatePath("/admin/provas"); revalidatePath(`/admin/provas/${id}`); revalidatePath("/questoes");
  return { ok: "Prova salva. As questões dela foram atualizadas." };
}

/** modo "vazia": só exclui se não tiver questões. modo "tudo": exclui a prova e todas as suas questões. */
export async function excluirProva(fd: FormData) {
  await requireAdmin();
  const id = Number(txt(fd, "id")), modo = txt(fd, "modo");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.questions).where(eq(s.questions.examId, id));
  if (n > 0 && modo !== "tudo") redirect(`/admin/provas/${id}?erro=tem-questoes`);
  if (n > 0) { await db.delete(s.questions).where(eq(s.questions.examId, id)); await limparContextos(); }
  await db.delete(s.exams).where(eq(s.exams.id, id));
  revalidatePath("/admin/provas"); revalidatePath("/admin/questoes"); revalidatePath("/questoes");
  redirect("/admin/provas");
}

export async function sincronizarProvasAcao() {
  await requireAdmin();
  await sincronizarProvas();
  revalidatePath("/admin/provas");
  redirect("/admin/provas");
}

/* =================================================================== QUESTÕES */
function gabarito(t: ItemType, bruto: string): { valor: string | null } | { error: string } {
  const v = bruto.trim();
  if (!v) return { valor: null };
  const up = v.toUpperCase();
  if (t === "A") return up === "C" || up === "CERTO" ? { valor: "C" } : up === "E" || up === "ERRADO" ? { valor: "E" } : { error: "Gabarito do tipo A deve ser C (certo) ou E (errado)." };
  if (t === "B") return /^\d{1,3}$/.test(v) ? { valor: v.padStart(3, "0") } : { error: "Gabarito do tipo B deve ser um número de 000 a 999." };
  if (t === "C") return ["A", "B", "C", "D"].includes(up) ? { valor: up } : { error: "Gabarito do tipo C deve ser A, B, C ou D." };
  return { valor: v };
}

const MIMES: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

async function lerQuestao(fd: FormData) {
  const examId = Number(txt(fd, "examId")), number = Number(txt(fd, "number"));
  const itemType = txt(fd, "itemType") as ItemType;
  const text = txt(fd, "text");
  if (!examId) return { error: "Escolha a prova." };
  if (!Number.isInteger(number) || number < 1 || number > 999) return { error: "Informe o número do item (1 a 999)." };
  if (!TIPOS.includes(itemType)) return { error: "Escolha o tipo de item." };
  if (text.length < 5) return { error: "Escreva o enunciado." };
  const [exam] = await db.select().from(s.exams).where(eq(s.exams.id, examId));
  if (!exam) return { error: "Prova não encontrada." };

  let options: { letter: string; text: string }[] | null = null;
  if (itemType === "C") {
    options = ["A", "B", "C", "D"].map((l) => ({ letter: l, text: txt(fd, `opt${l}`) }));
    if (options.some((o) => !o.text)) return { error: "Preencha as quatro alternativas (A a D)." };
  }
  const g = gabarito(itemType, txt(fd, "correctAnswer"));
  if ("error" in g) return g;
  for (const f of fd.getAll("novasImagens")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (!MIMES[f.type]) return { error: `${f.name}: use PNG, JPG ou WEBP.` };
    if (f.size > 3_000_000) return { error: `${f.name}: máximo de 3 MB por figura.` };
  }
  const diff = txt(fd, "difficulty");
  return {
    exam, number, itemType, text, options, correctAnswer: g.valor,
    language: txt(fd, "language") || null,
    explanation: txt(fd, "explanation") || null,
    difficulty: (["facil", "media", "dificil"].includes(diff) ? diff : null) as "facil" | "media" | "dificil" | null,
    needsReview: fd.get("needsReview") === "on",
    contextText: txt(fd, "contextText"),
    separar: fd.get("separarContexto") === "on",
    subjectIds: fd.getAll("subjectId").map(Number).filter(Boolean),
    newSubject: txt(fd, "newSubject"),
    workIds: fd.getAll("workId").map(Number).filter(Boolean),
  };
}

async function salvarImagens(fd: FormData): Promise<string[]> {
  const out: string[] = [];
  for (const f of fd.getAll("novasImagens")) {
    if (!(f instanceof File) || f.size === 0) continue;
    const buf = Buffer.from(await f.arrayBuffer());
    const name = createHash("sha1").update(buf).digest("hex").slice(0, 16) + MIMES[f.type];
    await db.insert(s.storedImages).values({ name, data: buf.toString("base64"), mime: f.type }).onConflictDoNothing();
    out.push(`api/img/${name}`);
  }
  return out;
}

/** Texto-base: edita o compartilhado, ou cria um próprio da questão (copiando as figuras do original). */
async function gravarContexto(questionId: string, atual: string | null, texto: string, separar: boolean): Promise<string | null> {
  if (!texto) return null;
  if (atual && !separar) { await db.update(s.contexts).set({ text: texto }).where(eq(s.contexts.id, atual)); return atual; }
  const imagens = atual ? (await db.select().from(s.contexts).where(eq(s.contexts.id, atual)))[0]?.images ?? [] : [];
  const novo = `${questionId}-ctx`;
  await db.insert(s.contexts).values({ id: novo, text: texto, images: imagens }).onConflictDoUpdate({ target: s.contexts.id, set: { text: texto } });
  return novo;
}

async function vincular(id: string, q: { subjectIds: number[]; newSubject: string; workIds: number[] }) {
  const subjectIds = [...q.subjectIds];
  if (q.newSubject) {
    await db.insert(s.subjects).values({ name: q.newSubject, slug: slug(q.newSubject) }).onConflictDoNothing();
    const [novo] = await db.select().from(s.subjects).where(eq(s.subjects.slug, slug(q.newSubject)));
    if (novo && !subjectIds.includes(novo.id)) subjectIds.push(novo.id);
  }
  await db.delete(s.questionSubjects).where(eq(s.questionSubjects.questionId, id));
  if (subjectIds.length) await db.insert(s.questionSubjects).values(subjectIds.map((subjectId) => ({ questionId: id, subjectId })));
  await db.delete(s.questionWorks).where(eq(s.questionWorks.questionId, id));
  if (q.workIds.length) await db.insert(s.questionWorks).values(q.workIds.map((workId) => ({ questionId: id, workId })));
}

export async function criarQuestao(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const q = await lerQuestao(fd);
  if ("error" in q) return q;
  const id = `${slug(q.exam.name)}${q.language ? "-" + slug(q.language) : ""}-q${q.number}`;
  const [dup] = await db.select({ id: s.questions.id }).from(s.questions).where(eq(s.questions.id, id));
  if (dup) return { error: `Já existe a questão ${id}. Edite essa em vez de criar outra.` };
  const imagens = await salvarImagens(fd);
  const contextId = await gravarContexto(id, null, q.contextText, true);
  await db.insert(s.questions).values({
    id, text: q.text, year: q.exam.year, stage: q.exam.stage, subprogram: q.exam.subprogram, examLabel: q.exam.name, examId: q.exam.id,
    number: q.number, language: q.language, itemType: q.itemType, options: q.options, images: imagens, contextId,
    correctAnswer: q.correctAnswer, explanation: q.explanation, difficulty: q.difficulty, needsReview: q.needsReview,
  });
  await vincular(id, q);
  revalidatePath("/admin/questoes"); revalidatePath("/questoes");
  redirect(`/admin/questoes/${encodeURIComponent(id)}?criada=1`);
}

export async function atualizarQuestao(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const id = txt(fd, "id");
  const [atual] = await db.select().from(s.questions).where(eq(s.questions.id, id));
  if (!atual) return { error: "Questão não encontrada." };
  const q = await lerQuestao(fd);
  if ("error" in q) return q;
  const remover = new Set(fd.getAll("removerImagem").map(String));
  const imagens = [...atual.images.filter((i) => !remover.has(i)), ...(await salvarImagens(fd))];
  const contextId = await gravarContexto(id, atual.contextId, q.contextText, q.separar);
  await db.update(s.questions).set({
    text: q.text, year: q.exam.year, stage: q.exam.stage, subprogram: q.exam.subprogram, examLabel: q.exam.name, examId: q.exam.id,
    number: q.number, language: q.language, itemType: q.itemType, options: q.options, images: imagens, contextId,
    correctAnswer: q.correctAnswer, explanation: q.explanation, difficulty: q.difficulty, needsReview: q.needsReview,
  }).where(eq(s.questions.id, id));
  await vincular(id, q);
  await limparContextos();
  revalidatePath("/admin/questoes"); revalidatePath(`/admin/questoes/${id}`); revalidatePath("/questoes");
  return { ok: "Questão salva." };
}

export async function excluirQuestao(fd: FormData) {
  await requireAdmin();
  await db.delete(s.questions).where(eq(s.questions.id, txt(fd, "id")));
  await limparContextos();
  revalidatePath("/admin/questoes"); revalidatePath("/questoes");
  const voltar = txt(fd, "voltar");
  redirect(voltar.startsWith("/admin") ? voltar : "/admin/questoes");
}
