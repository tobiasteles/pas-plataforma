"use client";
import { useActionState } from "react";
import type { FormState } from "@/actions/crud";

type Inicial = { id: number; name: string; year: number; stage: string; subprogram: string | null; notes: string | null };

export default function ProvaForm({ action, inicial }: { action: (s: FormState, f: FormData) => Promise<FormState>; inicial?: Inicial }) {
  const [st, run, pendente] = useActionState(action, undefined);
  return (
    <form action={run} className="card grid gap-3 sm:grid-cols-6">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <label className="text-xs text-suave sm:col-span-4">Nome da prova
        <input name="name" required defaultValue={inicial?.name} className="input mt-0.5" placeholder="PAS 1 – Edital 2025" /></label>
      <label className="text-xs text-suave sm:col-span-1">Ano
        <input name="year" type="number" required min={1990} max={2100} defaultValue={inicial?.year} className="input mt-0.5" /></label>
      <label className="text-xs text-suave sm:col-span-1">Etapa
        <select name="stage" defaultValue={inicial?.stage ?? "PAS1"} className="input mt-0.5"><option value="PAS1">PAS 1</option><option value="PAS2">PAS 2</option><option value="PAS3">PAS 3</option></select></label>
      <label className="text-xs text-suave sm:col-span-2">Subprograma (opcional)
        <input name="subprogram" defaultValue={inicial?.subprogram ?? ""} className="input mt-0.5" placeholder="2023-2025" /></label>
      <label className="text-xs text-suave sm:col-span-4">Observações (opcional)
        <input name="notes" defaultValue={inicial?.notes ?? ""} className="input mt-0.5" /></label>
      {inicial && <p className="text-xs text-suave sm:col-span-6">Ao salvar, nome, ano, etapa e subprograma são atualizados em todas as questões desta prova.</p>}
      <div className="flex items-center gap-3 sm:col-span-6">
        <button className="btn btn-primary" disabled={pendente}>{inicial ? "Salvar prova" : "Criar prova"}</button>
        {st?.error && <p role="alert" className="text-sm font-bold text-erro">{st.error}</p>}
        {st?.ok && <p role="status" className="text-sm font-bold text-acerto-texto">{st.ok}</p>}
      </div>
    </form>
  );
}
