"use client";
import { useActionState, useState } from "react";
import type { FormState } from "@/actions/crud";

export type QuestaoInicial = {
  id?: string; examId?: number | null; number?: number; language?: string | null; itemType: "A" | "B" | "C" | "D";
  text: string; options: { letter: string; text: string }[] | null; images: string[];
  contextText: string; contextShared: number; correctAnswer: string | null; explanation: string | null;
  difficulty: string | null; subjectIds: number[]; workIds: number[]; needsReview: boolean;
};
type Props = {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  inicial: QuestaoInicial;
  provas: { id: number; name: string }[];
  disciplinas: { id: number; name: string }[];
  obras: { id: number; title: string }[];
};

const TIPOS = { A: "A · Certo ou errado", B: "B · Resposta numérica (000 a 999)", C: "C · Múltipla escolha", D: "D · Discursiva" } as const;

export default function QuestionForm({ action, inicial, provas, disciplinas, obras }: Props) {
  const [st, run, pendente] = useActionState(action, undefined);
  const [tipo, setTipo] = useState(inicial.itemType);
  const editando = !!inicial.id;
  const op = (l: string) => inicial.options?.find((o) => o.letter === l)?.text ?? "";

  return (
    <form action={run} className="space-y-5">
      {editando && <input type="hidden" name="id" value={inicial.id} />}

      <section className="card grid gap-3 sm:grid-cols-6">
        <label className="text-xs text-suave sm:col-span-3">Prova
          <select name="examId" required defaultValue={inicial.examId ?? ""} className="input mt-0.5">
            <option value="" disabled>Escolha…</option>
            {provas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label className="text-xs text-suave sm:col-span-1">Nº do item
          <input name="number" type="number" min={1} max={999} required defaultValue={inicial.number} className="input mt-0.5" /></label>
        <label className="text-xs text-suave sm:col-span-2">Língua (só itens de língua)
          <select name="language" defaultValue={inicial.language ?? ""} className="input mt-0.5">
            <option value="">Não se aplica</option><option>Espanhola</option><option>Francesa</option><option>Inglesa</option></select></label>
        <label className="text-xs text-suave sm:col-span-3">Tipo de item
          <select name="itemType" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="input mt-0.5">
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs text-suave sm:col-span-3">Dificuldade
          <select name="difficulty" defaultValue={inicial.difficulty ?? ""} className="input mt-0.5">
            <option value="">Sem classificação</option><option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option></select></label>
      </section>

      <section className="card space-y-3">
        <label className="block text-xs text-suave">Texto-base (opcional)
          <textarea name="contextText" rows={6} defaultValue={inicial.contextText} className="input mt-0.5 font-leitura" /></label>
        {editando && inicial.contextShared > 1 && (
          <label className="flex items-start gap-2 rounded-md bg-duvida-fundo p-3 text-sm text-duvida-texto">
            <input type="checkbox" name="separarContexto" className="mt-1" />
            <span>Este texto-base é compartilhado com {inicial.contextShared} questões. Alterar muda todas elas. Marque aqui para aplicar a mudança só a esta questão.</span>
          </label>
        )}
        <label className="block text-xs text-suave">Enunciado
          <textarea name="text" rows={5} required defaultValue={inicial.text} className="input mt-0.5 font-leitura" /></label>

        {tipo === "C" && (
          <div className="grid gap-2">
            {["A", "B", "C", "D"].map((l) => (
              <label key={l} className="flex items-center gap-2 text-sm"><b className="w-5">{l}</b>
                <input name={`opt${l}`} defaultValue={op(l)} className="input" placeholder={`Alternativa ${l}`} /></label>))}
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <p className="text-sm font-bold">Figuras do enunciado</p>
        {inicial.images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {inicial.images.map((src) => (
              <label key={src} className="w-36 text-xs text-suave">
                <img src={`/${src}`} alt="" className="h-24 w-full rounded-md border border-linha bg-white object-contain" />
                <span className="mt-1 flex items-center gap-1"><input type="checkbox" name="removerImagem" value={src} /> remover</span>
              </label>))}
          </div>)}
        <input type="file" name="novasImagens" accept="image/png,image/jpeg,image/webp" multiple className="input" />
        <p className="text-xs text-suave">PNG, JPG ou WEBP, até 3 MB cada.</p>
      </section>

      <section className="card grid gap-3 sm:grid-cols-6">
        <label className="text-xs text-suave sm:col-span-2">
          Gabarito {tipo === "A" ? "(C ou E)" : tipo === "B" ? "(000 a 999)" : tipo === "C" ? "(A a D)" : "(espelho de resposta)"}
          {tipo === "D"
            ? <textarea key={tipo} name="correctAnswer" rows={4} defaultValue={inicial.correctAnswer ?? ""} className="input mt-0.5" />
            : <input key={tipo} name="correctAnswer" defaultValue={inicial.correctAnswer ?? ""} className="input mt-0.5" placeholder="deixe vazio se ainda não souber" />}
        </label>
        <label className="text-xs text-suave sm:col-span-4">Resolução comentada
          <textarea name="explanation" rows={4} defaultValue={inicial.explanation ?? ""} className="input mt-0.5 font-leitura" /></label>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <fieldset><legend className="mb-1 text-sm font-bold">Disciplinas</legend>
          <div className="grid gap-1 text-sm">{disciplinas.map((d) => (
            <label key={d.id} className="flex items-center gap-2"><input type="checkbox" name="subjectId" value={d.id} defaultChecked={inicial.subjectIds.includes(d.id)} /> {d.name}</label>))}</div>
          <input name="newSubject" className="input mt-2" placeholder="Nova disciplina (opcional)" />
        </fieldset>
        <fieldset><legend className="mb-1 text-sm font-bold">Obras citadas</legend>
          {obras.length === 0 ? <p className="text-sm text-suave">Nenhuma obra cadastrada ainda.</p> :
            <div className="grid gap-1 text-sm">{obras.map((o) => (
              <label key={o.id} className="flex items-center gap-2"><input type="checkbox" name="workId" value={o.id} defaultChecked={inicial.workIds.includes(o.id)} /> {o.title}</label>))}</div>}
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="needsReview" defaultChecked={inicial.needsReview} /> Marcar como “revisar”</label>
        </fieldset>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={pendente}>{pendente ? "Salvando…" : editando ? "Salvar questão" : "Criar questão"}</button>
        {st?.error && <p role="alert" className="text-sm font-bold text-erro">{st.error}</p>}
        {st?.ok && <p role="status" className="text-sm font-bold text-acerto-texto">{st.ok}</p>}
      </div>
    </form>
  );
}
