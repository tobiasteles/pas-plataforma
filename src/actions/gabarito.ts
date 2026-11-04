"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";

export type EntradaGab = { caderno: string | null; secao: string; numero: number; resposta: string | null; tipoB: boolean };
export type Previa = { cadernos: (string | null)[]; entradas: EntradaGab[]; avisos: string[] };
export type LerState = { error?: string; previa?: Previa } | undefined;
export type AplicarState = { ok?: string; error?: string; detalhes?: string[] } | undefined;

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const LINGUAS = [["INGLES", "Inglesa"], ["FRANCES", "Francesa"], ["ESPANHOL", "Espanhola"]] as const;
const linguaDe = (secao: string) => LINGUAS.find(([k]) => norm(secao).includes(k))?.[1] ?? null;
const lista = (xs: string[]) => (xs.length > 25 ? xs.slice(0, 25).join(", ") + `… (+${xs.length - 25})` : xs.join(", "));

/** Passo 1: manda o PDF ao extrator e devolve o que ele leu, sem gravar nada. */
export async function lerGabarito(_: LerState, fd: FormData): Promise<LerState> {
  await requireAdmin();
  const base = process.env.EXTRATOR_URL?.replace(/\/$/, "");
  if (!base) return { error: "EXTRATOR_URL não configurada no .env.local." };
  const f = fd.get("pdf");
  if (!(f instanceof File) || f.size === 0) return { error: "Selecione o PDF do gabarito." };
  try {
    const body = new FormData();
    body.append("arquivo", f, f.name);
    const r = await fetch(`${base}/gabarito`, {
      method: "POST", body, headers: process.env.EXTRATOR_KEY ? { "x-api-key": process.env.EXTRATOR_KEY } : {}, signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) {
      const det = (await r.json().catch(() => null))?.detail;
      return { error: typeof det === "string" ? det : `O extrator respondeu erro ${r.status}.` };
    }
    return { previa: (await r.json()) as Previa };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { error: m === "fetch failed" ? `Não consegui falar com o extrator em ${base}. Ele está rodando (python -m uvicorn app:app --host 127.0.0.1 --port 8001)?` : m || "Falha ao ler o gabarito." };
  }
}

/** Passo 2: grava as respostas confirmadas nas questões da prova escolhida. */
export async function aplicarGabarito(_: AplicarState, fd: FormData): Promise<AplicarState> {
  await requireAdmin();
  const examId = Number(fd.get("examId"));
  let entradas: EntradaGab[] = [];
  try { entradas = JSON.parse(String(fd.get("payload") ?? "[]")); } catch { return { error: "Dados inválidos. Leia o PDF de novo." }; }
  if (!examId) return { error: "Escolha a prova." };
  if (!entradas.length) return { error: "Marque pelo menos uma seção." };

  const qs = await db.select({ id: s.questions.id, number: s.questions.number, language: s.questions.language, itemType: s.questions.itemType })
    .from(s.questions).where(eq(s.questions.examId, examId));
  const idx = new Map<string, typeof qs>();
  for (const q of qs) { const k = `${q.language ?? ""}|${q.number}`; idx.set(k, [...(idx.get(k) ?? []), q]); }

  let aplicados = 0, semResposta = 0, viraramB = 0;
  const naoAchadas: string[] = [], ambiguas: string[] = [], incompat: string[] = [];
  for (const e of entradas) {
    const rotulo = `${e.numero}`;
    const achadas = idx.get(`${linguaDe(e.secao) ?? ""}|${e.numero}`) ?? [];
    if (achadas.length === 0) { naoAchadas.push(rotulo); continue; }
    if (achadas.length > 1) { ambiguas.push(rotulo); continue; }
    if (!e.resposta) { semResposta++; continue; }
    const q = achadas[0];
    let valor = e.resposta.toUpperCase();
    let virarB = false;
    if (e.tipoB) {
      if (!/^\d{1,3}$/.test(valor)) { incompat.push(rotulo); continue; }
      valor = valor.padStart(3, "0");
      virarB = q.itemType !== "B";
    } else if (q.itemType === "A") {
      if (!["C", "E"].includes(valor)) { incompat.push(rotulo); continue; }
    } else if (q.itemType === "C") {
      if (!["A", "B", "C", "D"].includes(valor)) { incompat.push(rotulo); continue; }
    } else { incompat.push(rotulo); continue; }
    await db.update(s.questions).set(virarB ? { correctAnswer: valor, itemType: "B", options: null } : { correctAnswer: valor }).where(eq(s.questions.id, q.id));
    aplicados++; if (virarB) viraramB++;
  }
  revalidatePath("/admin"); revalidatePath("/admin/questoes"); revalidatePath("/questoes");

  const detalhes: string[] = [];
  if (viraramB) detalhes.push(`${viraramB} itens passaram a tipo B porque o gabarito os marca assim.`);
  if (naoAchadas.length) detalhes.push(`Sem questão correspondente na prova (${naoAchadas.length}): ${lista(naoAchadas)}. Cadastre ou corrija a numeração/língua dessas questões.`);
  if (ambiguas.length) detalhes.push(`Mais de uma questão com o mesmo número (${ambiguas.length}): ${lista(ambiguas)}. Nada foi gravado nelas.`);
  if (incompat.length) detalhes.push(`Resposta incompatível com o tipo do item (${incompat.length}): ${lista(incompat)}. Confira o tipo da questão.`);
  if (semResposta) detalhes.push(`${semResposta} itens sem resposta no PDF (anulados ou não lidos).`);
  return { ok: `${aplicados} gabaritos aplicados.`, detalhes };
}
