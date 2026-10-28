"use client";
import { useRef, useState, useTransition } from "react";
import { registrarResposta } from "@/actions/answers";
import type { QuestionView } from "@/lib/queries";

export type Answer = { answer: string | null; status: "certeza" | "duvida" | "branco" };
type Feedback = { isCorrect: boolean | null; delta: number; correctAnswer: string | null; explanation: string | null };

const TIPOS: Record<string, string> = { A: "Tipo A · Certo/Errado", B: "Tipo B · Numérico", C: "Tipo C · Múltipla escolha", D: "Tipo D · Discursiva" };

type Props = {
  q: QuestionView;
  /** treino: corrige na hora | prova: só coleta (o gabarito nem chega ao navegador) */
  mode: "treino" | "prova";
  value?: Answer;
  onChange?: (a: Answer, timeSpentSec: number) => void;
  simuladoId?: number;
  actions?: React.ReactNode;
  showContext?: boolean;
};

export default function QuestionCard({ q, mode, value, onChange, actions, showContext = true }: Props) {
  const [local, setLocal] = useState<Answer>({ answer: null, status: "certeza" });
  const cur = value ?? local;
  const [fb, setFb] = useState<Feedback | null>(null);
  const [pending, start] = useTransition();
  const t0 = useRef(Date.now());
  const elapsed = () => (Date.now() - t0.current) / 1000;

  function set(a: Partial<Answer>) {
    const next = { ...cur, ...a } as Answer;
    if (next.answer === "" ) next.answer = null;
    setLocal(next);
    onChange?.(next, elapsed());
  }
  function conferir() {
    start(async () => {
      const r = await registrarResposta({ questionId: q.id, answer: cur.answer, status: cur.answer ? cur.status : "branco", timeSpentSec: elapsed() });
      setFb(r);
    });
  }
  const locked = mode === "treino" && fb !== null;

  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="tag">{q.examLabel}</span>
        <span className="tag">Item {q.number}{q.language ? ` · ${q.language}` : ""}</span>
        <span className="tag">{TIPOS[q.itemType]}</span>
        {q.subjects.map((s) => <span key={s.slug} className="tag">{s.name}</span>)}
        {q.works.map((w) => <a key={w.id} href={`/obras/${w.id}`} className="tag text-blue-600 hover:underline">♪ {w.title}</a>)}
        {q.needsReview && <span className="tag bg-amber-100 text-amber-800" title="a extração pode ter errado aqui">revisar</span>}
      </div>

      {showContext && (q.contextText || q.contextImages.length > 0) && (
        <div className="whitespace-pre-line border-l-2 border-stone-300 pl-3 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400">
          {q.contextText}
          {q.contextImages.map((src) => <img key={src} src={`/${src}`} alt="figura da prova" className="my-2 max-w-full rounded border bg-white" loading="lazy" />)}
        </div>
      )}

      <p className="whitespace-pre-line"><b className="mr-1.5">{q.number}</b>{q.text}</p>
      {q.images.map((src) => <img key={src} src={`/${src}`} alt="figura da questão" className="max-w-full rounded border bg-white" loading="lazy" />)}

      {/* ---- entrada de resposta por tipo ---- */}
      {q.itemType === "A" && (
        <div className="flex gap-2">
          {(["C", "E"] as const).map((v) => (
            <button key={v} disabled={locked} onClick={() => set({ answer: cur.answer === v ? null : v })}
              className={`btn ${cur.answer === v ? "btn-primary" : ""}`}>{v === "C" ? "Certo" : "Errado"}</button>
          ))}
          <span className="self-center text-xs text-stone-500">{cur.answer ? "" : "em branco = 0 ponto"}</span>
        </div>
      )}
      {q.itemType === "B" && (
        <input inputMode="numeric" maxLength={3} placeholder="000" disabled={locked} value={cur.answer ?? ""}
          onChange={(e) => set({ answer: e.target.value.replace(/\D/g, "").slice(0, 3) })} className="input w-28 text-center font-mono text-lg tracking-widest" />
      )}
      {q.itemType === "C" && (
        <ul className="space-y-1.5">
          {q.options?.map((o) => (
            <li key={o.letter}>
              <button disabled={locked} onClick={() => set({ answer: cur.answer === o.letter ? null : o.letter })}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${cur.answer === o.letter ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-stone-300 dark:border-stone-700"}
                ${fb?.correctAnswer === o.letter ? "!border-green-600 !bg-green-50 dark:!bg-green-950" : ""}`}>
                <b className="mr-2">{o.letter}</b>{o.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.itemType === "D" && (
        <textarea rows={5} className="input" placeholder="Escreva sua resposta (autocorreção com o espelho depois)…" disabled={locked}
          value={cur.answer ?? ""} onChange={(e) => set({ answer: e.target.value })} />
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {q.itemType !== "D" && cur.answer && (
          <select className="input w-auto" value={cur.status} disabled={locked} onChange={(e) => set({ status: e.target.value as Answer["status"] })}>
            <option value="certeza">Tenho certeza</option>
            <option value="duvida">Dúvida</option>
          </select>
        )}
        {mode === "treino" && !fb && <button className="btn btn-primary" disabled={pending} onClick={conferir}>{cur.answer ? "Conferir" : "Ver gabarito (em branco)"}</button>}
        <span className="ml-auto flex gap-2">{actions}</span>
      </div>

      {fb && (
        <div className={`rounded-lg border p-3 text-sm ${fb.isCorrect === true ? "border-green-600" : fb.isCorrect === false ? "border-red-600" : "border-stone-400"}`}>
          <p className="font-medium">
            {fb.isCorrect === true && `✓ Correto (${fb.delta > 0 ? "+" : ""}${fb.delta})`}
            {fb.isCorrect === false && `✗ Errado (${fb.delta})`}
            {fb.isCorrect === null && "Resposta registrada."}
            {fb.correctAnswer ? ` Gabarito: ${fb.correctAnswer}` : " Esta questão ainda não tem gabarito."}
          </p>
          {fb.explanation && <p className="mt-1 whitespace-pre-line text-stone-600 dark:text-stone-400">{fb.explanation}</p>}
        </div>
      )}
    </article>
  );
}
