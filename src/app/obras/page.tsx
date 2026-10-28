import Link from "next/link";
import { listWorks } from "@/lib/queries";
const TIPO = { visual: "Visual", musical: "Musical", literaria: "Literária", teatral: "Teatral", cinema: "Cinema" } as const;

export default async function Obras() {
  const works = await listWorks();
  const grupos: Record<string, typeof works> = {};
  for (const w of works) (grupos[w.stage] ??= []).push(w);
  return (
    <>
      <h1 className="text-2xl font-bold">Obras obrigatórias</h1>
      {!works.length && <p className="text-stone-500">Nenhuma obra cadastrada ainda (o admin cadastra em Admin → Obras).</p>}
      {Object.entries(grupos).map(([stage, ws]) => (
        <section key={stage} className="space-y-2">
          <h2 className="font-semibold">{stage.replace("PAS", "PAS ")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {ws.map((w) => (
              <Link key={w.id} href={`/obras/${w.id}`} className="card hover:border-blue-600">
                <p className="font-medium">{w.title}</p><p className="text-sm text-stone-500">{w.author} · {TIPO[w.type]}</p>
              </Link>))}
          </div>
        </section>))}
    </>
  );
}
