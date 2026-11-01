"use client";

import ItemCard from "@/components/ItemCard";
import { registrarResposta } from "@/actions/answers";
import type { QuestionView } from "@/lib/queries";

/** Liga o ItemCard (só visual) à Server Action que corrige e grava a resposta. */
export default function ItemCardConectado({ q }: { q: QuestionView }) {
  return (
    <ItemCard
      item={{
        id: q.id, examLabel: q.examLabel, number: q.number, language: q.language, itemType: q.itemType, text: q.text,
        options: q.options, contextText: q.contextText, contextImages: q.contextImages, images: q.images,
        subjects: q.subjects, works: q.works, difficulty: q.difficulty,
      }}
      onSubmit={async ({ answer, confidence, timeSpentSec }) => {
        const r = await registrarResposta({ questionId: q.id, answer, status: answer ? confidence : "branco", timeSpentSec });
        return { isCorrect: r.isCorrect, delta: r.delta, correctAnswer: r.correctAnswer, explanation: r.explanation };
      }}
    />
  );
}
