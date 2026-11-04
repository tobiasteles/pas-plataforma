"use client";
import { useActionState, useMemo, useState } from "react";
import { aplicarGabarito, lerGabarito, type EntradaGab } from "@/actions/gabarito";

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const ehLingua = (secao: string) => ["INGLES", "FRANCES", "ESPANHOL"].some((k) => norm(secao).includes(k));

export default function GabaritoPdf({ provas }: { provas: { id: number; name: string }[] }) {
  const [lido, ler, lendo] = useActionState(lerGabarito, undefined);
  const [res, aplicar, aplicando] = useActionState(aplicarGabarito, undefined);
  const [caderno, setCaderno] = useState<string | null | undefined>(undefined);
  const [troca, setTroca] = useState<Record<string, boolean>>({});
  const previa = lido?.previa;
  const cadernoAtual = caderno === undefined ? previa?.cadernos[0] ?? null : caderno;

  /* seções do caderno escolhido, na ordem em que aparecem no PDF */
  const secoes = useMemo(() => {
    const m = new Map<string, EntradaGab[]>();
    for (const e of previa?.entradas ?? []) if (e.caderno === cadernoAtual) m.set(e.secao, [...(m.get(e.secao) ?? []), e]);
    const lista = [...m.entries()].map(([nome, es]) => ({ nome, es }));
    // seções sem língua que repetem números (ex.: Artes Visuais/Cênicas/Música) começam desmarcadas
    const usos = new Map<number, number>();
    for (const { nome, es } of lista) if (!ehLingua(nome)) for (const e of es) usos.set(e.numero, (usos.get(e.numero) ?? 0) + 1);
    return lista.map(({ nome, es }) => ({ nome, es, conflito: !ehLingua(nome) && es.some((e) => (usos.get(e.numero) ?? 0) > 1) }));
  }, [previa, cadernoAtual]);

  const marcada = (nome: string, conflito: boolean) => troca[`${cadernoAtual}|${nome}`] ?? !conflito;
  const escolhidas = secoes.filter((s) => marcada(s.nome, s.conflito)).flatMap((s) => s.es);

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">Enviar gabarito em PDF</h2>
      <p className="text-xs text-suave">Leia o PDF, confira as respostas na tela e só então aplique. Nada é gravado antes de você confirmar.</p>

      <form action={ler} className="flex flex-wrap items-center gap-3">
        <input type="file" name="pdf" accept="application/pdf" className="input max-w-sm" />
        <button className="btn" disabled={lendo}>{lendo ? "Lendo…" : "Ler gabarito"}</button>
      </form>
      {lido?.error && <p role="alert" className="text-sm font-bold text-erro">{lido.error}</p>}

      {previa && (
        <div className="space-y-4">
          {previa.avisos.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm text-duvida-texto">{previa.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
          {previa.cadernos.length > 1 && (
            <label className="block text-xs text-suave">Caderno
              <select className="input mt-0.5 max-w-xs" value={cadernoAtual ?? ""} onChange={(e) => setCaderno(e.target.value || null)}>
                {previa.cadernos.map((c) => <option key={c ?? ""} value={c ?? ""}>{c ?? "Sem nome"}</option>)}</select></label>)}
          {previa.cadernos.length === 1 && previa.cadernos[0] && <p className="text-sm">Caderno <b>{previa.cadernos[0]}</b></p>}

          <div className="space-y-3">
            {secoes.map(({ nome, es, conflito }) => (
              <fieldset key={nome} className="rounded-lg border border-linha p-3">
                <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={marcada(nome, conflito)} onChange={(e) => setTroca((t) => ({ ...t, [`${cadernoAtual}|${nome}`]: e.target.checked }))} />
                  {nome} <span className="font-normal text-suave">itens {es[0].numero} a {es[es.length - 1].numero}</span>
                  {conflito && <span className="rounded-md bg-duvida-fundo px-2 py-0.5 text-xs font-normal text-duvida-texto">numeração repetida: marque só a que existe na sua prova</span>}
                </label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {es.map((e) => (
                    <span key={e.numero} className={`inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 text-xs tabular-nums ${e.resposta ? "border-linha" : "border-erro text-erro"}`}>
                      <span className="text-suave">{e.numero}</span><b className={e.tipoB ? "font-mono" : ""}>{e.resposta ?? "?"}</b>
                    </span>))}
                </div>
              </fieldset>))}
          </div>

          <form action={aplicar} className="flex flex-wrap items-end gap-3 border-t border-linha pt-4">
            <input type="hidden" name="payload" value={JSON.stringify(escolhidas)} />
            <label className="min-w-[16rem] flex-1 text-xs text-suave">Aplicar na prova
              <select name="examId" required defaultValue="" className="input mt-0.5">
                <option value="" disabled>Escolha…</option>{provas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <button className="btn btn-primary" disabled={aplicando || escolhidas.length === 0}>{aplicando ? "Aplicando…" : `Aplicar ${escolhidas.length} respostas`}</button>
          </form>
        </div>
      )}

      {res?.error && <p role="alert" className="text-sm font-bold text-erro">{res.error}</p>}
      {res?.ok && (
        <div role="status" className="space-y-1 text-sm">
          <p className="font-bold text-acerto-texto">{res.ok}</p>
          {res.detalhes?.map((d, i) => <p key={i} className="text-suave">{d}</p>)}
        </div>)}
    </section>
  );
}
