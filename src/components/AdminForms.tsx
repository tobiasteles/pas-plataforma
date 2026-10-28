"use client";
import { useActionState } from "react";
import { enviarProvas, importarJson, importarGabaritos, type ImportState } from "@/actions/admin";

function Msg({ s }: { s: ImportState }) { return s?.ok ? <p className="whitespace-pre-line text-sm text-green-600">{s.ok}</p> : s?.error ? <p className="text-sm text-red-600">{s.error}</p> : null; }

export function ImportJson() {
  const [st, run, p] = useActionState(importarJson, undefined);
  return (
    <form action={run} className="card space-y-2">
      <h2 className="font-semibold">Importar questoes.json</h2>
      <p className="text-xs text-stone-500">Arquivo gerado pelo extrator Python. Pode reenviar o JSON inteiro sempre que atualizar: questões existentes são atualizadas (gabarito/resolução já preenchidos aqui são preservados). Copie a pasta <code>imagens/</code> para <code>public/dados/imagens/</code>.</p>
      <input type="file" name="arquivo" accept="application/json,.json" className="input" />
      <button className="btn btn-primary" disabled={p}>{p ? "Importando…" : "Importar"}</button><Msg s={st} />
    </form>
  );
}
export function ImportGabaritos() {
  const [st, run, p] = useActionState(importarGabaritos, undefined);
  return (
    <form action={run} className="card space-y-2">
      <h2 className="font-semibold">Importar gabaritos (CSV)</h2>
      <p className="text-xs text-stone-500">Cole com cabeçalho <code>id,gabarito</code>. Ex.: <code>PAS1-Edital-2025-q11,C</code></p>
      <textarea name="csv" rows={5} className="input font-mono" placeholder={"id,gabarito\nPAS1-Edital-2025-q11,C"} />
      <button className="btn btn-primary" disabled={p}>Aplicar</button><Msg s={st} />
    </form>
  );
}

export function UploadProvas() {
  const [st, run, p] = useActionState(enviarProvas, undefined);
  return (
    <form action={run} className="card space-y-2">
      <h2 className="font-semibold">Enviar prova em PDF</h2>
      <p className="text-xs text-stone-500">Envie o PDF (pode selecionar vários, ex.: parte 1 e parte 2). O sistema extrai as questões e figuras, classifica por disciplina e grava no banco. Reenviar a mesma prova atualiza sem duplicar. Depois, revise em Questões → filtro “revisar” e preencha o gabarito.</p>
      <input type="file" name="pdfs" accept="application/pdf" multiple className="input" />
      <button className="btn btn-primary" disabled={p}>{p ? "Extraindo… (30–60 s por PDF)" : "Extrair e salvar"}</button><Msg s={st} />
    </form>
  );
}
