"use server";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { gradeOne } from "@/lib/scoring";

export type AnswerInput = {
  questionId: string;
  answer: string | null;
  status: "certeza" | "duvida" | "branco";
  timeSpentSec: number;
  simuladoId?: number;
};

/** Registra a resposta e devolve o feedback (gabarito e resolução) — uso no modo treino. */
export async function registrarResposta(input: AnswerInput) {
  const { userId } = await requireUser();
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, input.questionId));
  if (!q) throw new Error("Questão não encontrada");
  const blank = !input.answer?.trim();
  const g = gradeOne({ itemType: q.itemType, answer: input.answer, correct: q.correctAnswer });
  await db.insert(s.userAnswers).values({
    userId, questionId: q.id, simuladoId: input.simuladoId ?? null,
    answer: blank ? null : input.answer!.trim(), status: blank ? "branco" : input.status,
    isCorrect: g.isCorrect, scoreDelta: g.delta, timeSpentSec: Math.max(0, Math.round(input.timeSpentSec)),
  });
  return { isCorrect: g.isCorrect, delta: g.delta, correctAnswer: q.correctAnswer, explanation: q.explanation };
}
