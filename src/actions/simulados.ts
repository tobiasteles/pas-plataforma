"use server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { computeScore, gradeOne, normalize, type ItemType } from "@/lib/scoring";
import { searchQuestions } from "@/lib/queries";

/** Cria um simulado a partir de filtros (ou de uma lista) e vai para a prova. */
export async function criarSimulado(fd: FormData) {
  const { userId } = await requireUser();
  const count = Math.min(120, Math.max(5, Number(fd.get("count") ?? 20)));
  const stage = (String(fd.get("stage") ?? "") || undefined) as "PAS1" | "PAS2" | "PAS3" | undefined;
  const subject = String(fd.get("subject") ?? "") || undefined;
  const itemType = fd.getAll("itemType").map(String).filter((t) => "ABCD".includes(t)) as ItemType[];
  const listId = Number(fd.get("listId") ?? 0) || undefined;
  const { items } = await searchQuestions({
    stage, subject, itemType: itemType.length ? itemType : undefined, listId, random: true, pageSize: count,
  });
  if (!items.length) redirect("/simulados?erro=sem-questoes");
  const title = String(fd.get("title") ?? "").trim() || `Simulado ${new Date().toLocaleDateString("pt-BR")}`;
  const [sim] = await db.insert(s.simulados).values({ userId, title }).returning();
  await db.insert(s.simuladoItems).values(items.map((q, i) => ({ simuladoId: sim.id, questionId: q.id, position: i })));
  redirect(`/simulados/${sim.id}`);
}

export type SimuladoSubmission = {
  simuladoId: number;
  answers: { questionId: string; answer: string | null; status: "certeza" | "duvida" | "branco"; timeSpentSec: number }[];
};

/** Corrige no servidor (o gabarito nunca vai ao navegador durante a prova). */
export async function finalizarSimulado(sub: SimuladoSubmission) {
  const { userId } = await requireUser();
  const [sim] = await db.select().from(s.simulados).where(and(eq(s.simulados.id, sub.simuladoId), eq(s.simulados.userId, userId)));
  if (!sim || sim.finishedAt) throw new Error("Simulado indisponível");
  const items = await db.select({ q: s.questions }).from(s.simuladoItems).innerJoin(s.questions, eq(s.questions.id, s.simuladoItems.questionId)).where(eq(s.simuladoItems.simuladoId, sim.id));
  const byId = new Map(items.map((i) => [i.q.id, i.q]));
  const graded = [];
  const rows: (typeof s.userAnswers.$inferInsert)[] = [];
  for (const q of byId.values()) {
    const a = sub.answers.find((x) => x.questionId === q.id);
    const answer = normalize(q.itemType, a?.answer ?? null);
    const status = answer ? (a?.status === "branco" ? "certeza" : a?.status ?? "certeza") : "branco";
    const g = gradeOne({ itemType: q.itemType, answer, correct: q.correctAnswer });
    graded.push({ itemType: q.itemType as ItemType, answer, correct: q.correctAnswer, status });
    rows.push({ userId, questionId: q.id, simuladoId: sim.id, answer, status, isCorrect: g.isCorrect, scoreDelta: g.delta, timeSpentSec: Math.round(a?.timeSpentSec ?? 0) });
  }
  const result = computeScore(graded);
  await db.insert(s.userAnswers).values(rows);
  await db.update(s.simulados).set({ finishedAt: new Date(), result }).where(eq(s.simulados.id, sim.id));
  redirect(`/simulados/${sim.id}`);
}
