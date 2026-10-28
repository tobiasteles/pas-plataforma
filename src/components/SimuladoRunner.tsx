"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import QuestionCard, { type Answer } from "./QuestionCard";
import { finalizarSimulado } from "@/actions/simulados";
import type { QuestionView } from "@/lib/queries";

const fmt = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Modo prova Cebraspe: marcar Certo/Errado/Branco, cronômetro, correção só no servidor ao finalizar. */
export default function SimuladoRunner({ simuladoId, questions }: { simuladoId: number; questions: QuestionView[] }) {
  const [ans, setAns] = useState<Record<string, Answer & { t: number }>>({});
  const [sec, setSec] = useState(0);
  const [pending, go] = useTransition();
  const start = useRef(Date.now());
  useEffect(() => { const i = setInterval(() => setSec(Math.floor((Date.now() - start.current) / 1000)), 1000); return () => clearInterval(i); }, []);
  const feitas = Object.values(ans).filter((a) => a.answer).length;

  function enviar() {
    if (!confirm(`Finalizar? ${feitas} de ${questions.length} respondidas; o restante conta como branco.`)) return;
    go(() => finalizarSimulado({
      simuladoId,
      answers: questions.map((q) => ({ questionId: q.id, answer: ans[q.id]?.answer ?? null, status: ans[q.id]?.status ?? "branco", timeSpentSec: ans[q.id]?.t ?? 0 })),
    }));
  }
  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center gap-4 rounded-xl border bg-white/95 p-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
        <span className="font-mono">{fmt(sec)}</span><span className="text-sm text-stone-500">{feitas}/{questions.length} respondidas</span>
        <button className="btn btn-primary ml-auto" disabled={pending} onClick={enviar}>Finalizar e ver escore</button>
      </div>
      {questions.map((q) => (
        <QuestionCard key={q.id} q={q} mode="prova" value={ans[q.id] ?? { answer: null, status: "certeza" }}
          onChange={(a, t) => setAns((p) => ({ ...p, [q.id]: { ...a, t } }))} />
      ))}
    </div>
  );
}
