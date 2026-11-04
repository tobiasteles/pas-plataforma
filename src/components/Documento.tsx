import type { ReactNode } from "react";
import { ATUALIZADO_EM } from "@/lib/site";

export type Secao = { id?: string; titulo: string; texto: ReactNode };

/** Layout de página legal: título, data e seções numeradas. */
export default function Documento({ titulo, secoes }: { titulo: string; secoes: Secao[] }) {
  return (
    <article className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="mt-2 text-sm text-suave">Atualizado em {ATUALIZADO_EM}</p>
      <div className="mt-8 space-y-8">
        {secoes.map((s, i) => (
          <section key={s.titulo} id={s.id}>
            <h2 className="text-xl font-bold">{i + 1}. {s.titulo}</h2>
            <div className="mt-2 space-y-3 leading-relaxed text-grafite/90">{s.texto}</div>
          </section>))}
      </div>
    </article>
  );
}
