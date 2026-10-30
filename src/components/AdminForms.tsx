"use client";
import { useActionState, useState } from "react";
import {
  enviarProvas,
  importarJson,
  importarGabaritos,
  type ImportState,
} from "@/actions/admin";

function Msg({ s }: { s: ImportState }) {
  return (
    <>
      {s?.ok && (
        <p className="whitespace-pre-line text-sm text-green-600">{s.ok}</p>
      )}
      {s?.error && (
        <p className="whitespace-pre-line text-sm text-red-600">{s.error}</p>
      )}
    </>
  );
}

export function ImportJson() {
  const [st, run, p] = useActionState(importarJson, undefined);
  return (
    <form action={run} className="card space-y-2">
      <h2 className="font-semibold">Importar questoes.json</h2>
      <p className="text-xs text-stone-500">
        Arquivo gerado pelo extrator Python. Pode reenviar o JSON inteiro sempre
        que atualizar: questões existentes são atualizadas (gabarito/resolução
        já preenchidos aqui são preservados). Copie a pasta{" "}
        <code>imagens/</code> para <code>public/dados/imagens/</code>.
      </p>
      <input
        type="file"
        name="arquivo"
        accept="application/json,.json"
        className="input"
      />
      <button className="btn btn-primary" disabled={p}>
        {p ? "Importando…" : "Importar"}
      </button>
      <Msg s={st} />
    </form>
  );
}
export function ImportGabaritos() {
  const [st, run, p] = useActionState(importarGabaritos, undefined);
  return (
    <form action={run} className="card space-y-2">
      <h2 className="font-semibold">Importar gabaritos (CSV)</h2>
      <p className="text-xs text-stone-500">
        Cole com cabeçalho <code>id,gabarito</code>. Ex.:{" "}
        <code>PAS1-Edital-2025-q11,C</code>
      </p>
      <textarea
        name="csv"
        rows={5}
        className="input font-mono"
        placeholder={"id,gabarito\nPAS1-Edital-2025-q11,C"}
      />
      <button className="btn btn-primary" disabled={p}>
        Aplicar
      </button>
      <Msg s={st} />
    </form>
  );
}

export function UploadProvas() {
  const [st, run, p] = useActionState(enviarProvas, undefined);
  const [nomes, setNomes] = useState<string[]>([]);
  return (
    <form action={run} className="card space-y-3">
      <h2 className="font-semibold">Enviar prova em PDF</h2>
      <p className="text-xs text-stone-500">
        Selecione um ou mais PDFs. Nome, ano e etapa são opcionais: se ficarem
        em branco, o sistema tenta ler do próprio PDF. Para a mesma prova em
        vários PDFs (ex.: parte 1 e parte 2), use o mesmo nome. Reenviar uma
        prova com o mesmo nome atualiza sem duplicar.
      </p>
      <input
        type="file"
        name="pdfs"
        accept="application/pdf"
        multiple
        className="input"
        onChange={(e) =>
          setNomes(Array.from(e.target.files ?? []).map((f) => f.name))
        }
      />
      {nomes.map((n, i) => (
        <div
          key={n + i}
          className="grid gap-2 rounded-lg border border-stone-200 p-2 dark:border-stone-800 sm:grid-cols-[1fr_6rem_8rem]"
        >
          <p className="truncate text-xs text-stone-500 sm:col-span-3">{n}</p>
          <input
            name={`nome_${i}`}
            className="input"
            placeholder="Nome da prova (ex.: PAS 1 – Edital 2025)"
          />
          <input
            name={`ano_${i}`}
            type="number"
            min={1990}
            max={2100}
            className="input"
            placeholder="Ano"
          />
          <select name={`etapa_${i}`} className="input" defaultValue="">
            <option value="">Etapa (auto)</option>
            <option value="PAS1">PAS 1</option>
            <option value="PAS2">PAS 2</option>
            <option value="PAS3">PAS 3</option>
          </select>
        </div>
      ))}
      <button className="btn btn-primary" disabled={p}>
        {p ? "Extraindo…" : "Extrair e salvar"}
      </button>
      <Msg s={st} />
    </form>
  );
}
