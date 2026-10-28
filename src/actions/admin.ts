"use server";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";

type JsonQuestion = {
  id: string; prova: string; ano: number; parte?: number; numero: number; lingua?: string | null;
  disciplinas?: string[]; assuntos?: string[]; tipo: "certo_errado" | "multipla_escolha" | "numerica" | "discursiva";
  enunciado: string; opcoes?: { letra: string; texto: string }[] | null; imagens?: string[]; contexto_id?: string;
  gabarito?: string | null; explicacao?: string | null; dificuldade?: "facil" | "media" | "dificil" | null;
  obras?: string[]; revisar?: boolean; subprograma?: string | null; etapa?: "PAS1" | "PAS2" | "PAS3";
};
type JsonFile = { contextos?: { id: string; texto: string; imagens?: string[] }[]; questoes: JsonQuestion[] };

const TIPO = { certo_errado: "A", numerica: "B", multipla_escolha: "C", discursiva: "D" } as const;
const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const chunks = <T,>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export type ImportState = { ok?: string; error?: string } | undefined;

/** Importa/atualiza o JSON gerado pelo extrator. Reenviar o arquivo atualiza (upsert) sem duplicar. */
export async function importarJson(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = fd.get("arquivo") as File | null;
  const raw = file && file.size ? await file.text() : String(fd.get("json") ?? "");
  let data: JsonFile;
  try { data = JSON.parse(raw); } catch { return { error: "JSON inválido." }; }
  if (!Array.isArray(data.questoes)) return { error: "O JSON precisa ter a chave 'questoes'." };
  return { ok: await gravar(data) };
}

/** Grava contextos, questões e vínculos (upsert). Usado pelo import de JSON e pelo upload de PDF. */
async function gravar(data: JsonFile): Promise<string> {
  for (const part of chunks(data.contextos ?? [])) {
    await db.insert(s.contexts).values(part.map((c) => ({ id: c.id, text: c.texto, images: c.imagens ?? [] })))
      .onConflictDoUpdate({ target: s.contexts.id, set: { text: sqlExcluded("text"), images: sqlExcluded("images") } });
  }

  // disciplinas e assuntos
  const subjectNames = [...new Set(data.questoes.flatMap((q) => q.disciplinas ?? []))].filter((n) => n !== "Não classificada");
  for (const n of subjectNames) await db.insert(s.subjects).values({ name: n, slug: slug(n) }).onConflictDoNothing();
  const subj = await db.select().from(s.subjects);
  const subjBySlug = new Map(subj.map((x) => [x.slug, x.id]));

  let novas = 0;
  for (const part of chunks(data.questoes, 100)) {
    const vals = part.map((q) => {
      const ano = q.ano;
      return {
        id: q.id, text: q.enunciado, year: ano, stage: (q.etapa ?? `PAS${/PAS\s?(\d)/.exec(q.prova)?.[1] ?? "1"}`) as "PAS1" | "PAS2" | "PAS3",
        subprogram: q.subprograma ?? null, examLabel: q.prova, number: q.numero, language: q.lingua ?? null,
        itemType: TIPO[q.tipo], options: q.opcoes?.map((o) => ({ letter: o.letra, text: o.texto })) ?? null,
        images: q.imagens ?? [], contextId: q.contexto_id ?? null, correctAnswer: q.gabarito ?? null,
        explanation: q.explicacao ?? null, difficulty: q.dificuldade ?? null, needsReview: !!q.revisar,
      };
    });
    await db.insert(s.questions).values(vals).onConflictDoUpdate({
      target: s.questions.id,
      // não sobrescreve gabarito/explicação/dificuldade já preenchidos no admin, se o JSON vier sem eles
      set: { text: sqlExcluded("text"), options: sqlExcluded("options"), images: sqlExcluded("images"), contextId: sqlExcluded("context_id"),
        needsReview: sqlExcluded("needs_review"), correctAnswer: sqlCoalesce("correct_answer"), explanation: sqlCoalesce("explanation"), difficulty: sqlCoalesce("difficulty") },
    });
    novas += part.length;
  }

  // vínculos disciplina / assunto / obra (recria os da questão importada)
  const ids = data.questoes.map((q) => q.id);
  for (const part of chunks(ids)) {
    await db.delete(s.questionSubjects).where(inArray(s.questionSubjects.questionId, part));
    await db.delete(s.questionTopics).where(inArray(s.questionTopics.questionId, part));
  }
  const links: { questionId: string; subjectId: number }[] = [];
  for (const q of data.questoes) {
    for (const n of q.disciplinas ?? []) { const id = subjBySlug.get(slug(n)); if (id) links.push({ questionId: q.id, subjectId: id }); }
    for (const a of q.assuntos ?? []) {
      const sid = subjBySlug.get(slug(q.disciplinas?.[0] ?? "")); if (!sid) continue;
      const [t] = await db.insert(s.topics).values({ subjectId: sid, name: a, slug: slug(a) }).onConflictDoUpdate({ target: [s.topics.subjectId, s.topics.slug], set: { name: a } }).returning();
      await db.insert(s.questionTopics).values({ questionId: q.id, topicId: t.id }).onConflictDoNothing();
    }
    if (q.obras?.length) {
      const ws = await db.select().from(s.works);
      for (const t of q.obras) { const w = ws.find((x) => slug(x.title) === slug(t)); if (w) await db.insert(s.questionWorks).values({ questionId: q.id, workId: w.id }).onConflictDoNothing(); }
    }
  }
  for (const part of chunks(links, 500)) if (part.length) await db.insert(s.questionSubjects).values(part).onConflictDoNothing();

  revalidatePath("/", "layout");
  return `${novas} questões importadas/atualizadas, ${data.contextos?.length ?? 0} textos-base.`;
}

/**
 * Recebe PDFs de prova, manda ao serviço Python (extrator/), guarda as figuras no banco
 * e grava as questões automaticamente.
 */
export async function enviarProvas(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const base = process.env.EXTRATOR_URL;
  if (!base) return { error: "EXTRATOR_URL não configurada (veja o README: serviço do extrator)." };
  const files = fd.getAll("pdfs").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Selecione ao menos um PDF." };
  const linhas: string[] = [];
  for (const f of files) {
    try {
      const body = new FormData();
      body.append("arquivo", f, f.name);
      const r = await fetch(`${base.replace(/\/$/, "")}/extrair`, {
        method: "POST", body, headers: process.env.EXTRATOR_KEY ? { "x-api-key": process.env.EXTRATOR_KEY } : {},
        signal: AbortSignal.timeout(110_000),
      });
      if (!r.ok) { linhas.push(`✗ ${f.name}: ${(await r.json().catch(() => null))?.detail ?? `erro ${r.status}`}`); continue; }
      const out = (await r.json()) as JsonFile & { imagens: Record<string, string> };
      const imgs = Object.entries(out.imagens ?? {});
      for (const part of chunks(imgs, 20))
        await db.insert(s.storedImages).values(part.map(([name, data]) => ({ name, data }))).onConflictDoNothing();
      const troca = (p: string) => p.replace(/^dados\/imagens\//, "api/img/");
      for (const c of out.contextos ?? []) c.imagens = (c.imagens ?? []).map(troca);
      for (const q of out.questoes) q.imagens = (q.imagens ?? []).map(troca);
      const msg = await gravar(out);
      const rev = out.questoes.filter((q) => q.revisar).length;
      linhas.push(`✓ ${f.name}: ${msg} ${imgs.length} figuras.${rev ? ` ${rev} marcadas para revisar.` : ""}`);
    } catch (e) {
      linhas.push(`✗ ${f.name}: ${e instanceof Error ? e.message : "falha desconhecida"}`);
    }
  }
  return { ok: linhas.join("\n") };
}

import { sql } from "drizzle-orm";
const sqlExcluded = (col: string) => sql.raw(`excluded.${col}`);
const sqlCoalesce = (col: string) => sql.raw(`coalesce(questions.${col}, excluded.${col})`);

/** CSV "id,gabarito" (cabeçalho obrigatório). */
export async function importarGabaritos(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const text = String(fd.get("csv") ?? "");
  const rows = text.split(/\r?\n/).slice(1).map((l) => l.split(/[,;]/).map((x) => x.trim())).filter((r) => r[0] && r[1]);
  let n = 0;
  for (const [id, g] of rows) { const r = await db.update(s.questions).set({ correctAnswer: g.toUpperCase() }).where(eq(s.questions.id, id)).returning({ id: s.questions.id }); n += r.length; }
  return { ok: `${n} gabaritos aplicados (de ${rows.length} linhas).` };
}

export async function salvarQuestao(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id"));
  const diff = String(fd.get("difficulty") ?? "");
  await db.update(s.questions).set({
    correctAnswer: String(fd.get("correctAnswer") ?? "").trim() || null,
    explanation: String(fd.get("explanation") ?? "").trim() || null,
    difficulty: (["facil", "media", "dificil"].includes(diff) ? diff : null) as "facil" | "media" | "dificil" | null,
    needsReview: fd.get("needsReview") === "on",
  }).where(eq(s.questions.id, id));
  const workIds = fd.getAll("workId").map(Number).filter(Boolean);
  await db.delete(s.questionWorks).where(eq(s.questionWorks.questionId, id));
  if (workIds.length) await db.insert(s.questionWorks).values(workIds.map((workId) => ({ questionId: id, workId })));
  revalidatePath(`/admin/questoes/${id}`);
}

export async function criarObra(fd: FormData) {
  await requireAdmin();
  await db.insert(s.works).values({
    title: String(fd.get("title")).trim(), author: String(fd.get("author")).trim(),
    type: String(fd.get("type")) as "visual", stage: String(fd.get("stage")) as "PAS1",
    summary: String(fd.get("summary") ?? "").trim() || null, imageUrl: String(fd.get("imageUrl") ?? "").trim() || null,
  }).onConflictDoNothing();
  revalidatePath("/obras"); revalidatePath("/admin/obras");
}

export async function excluirObra(id: number) { await requireAdmin(); await db.delete(s.works).where(eq(s.works.id, id)); revalidatePath("/admin/obras"); }

export async function salvarCurso(fd: FormData) {
  await requireAdmin();
  await db.insert(s.courses).values({
    name: String(fd.get("name")).trim(), campus: String(fd.get("campus") ?? "Darcy Ribeiro").trim(), shift: String(fd.get("shift") ?? "").trim() || null,
    year: Number(fd.get("year")), cutoffPercent: Number(fd.get("cutoffPercent")), notes: String(fd.get("notes") ?? "").trim() || null,
  });
  revalidatePath("/admin/cursos"); revalidatePath("/cursos");
}
export async function excluirCurso(id: number) { await requireAdmin(); await db.delete(s.courses).where(eq(s.courses.id, id)); revalidatePath("/admin/cursos"); revalidatePath("/cursos"); }
