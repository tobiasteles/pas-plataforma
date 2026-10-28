import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { listSubjects } from "@/lib/queries";
import { criarSimulado } from "@/actions/simulados";

export default async function Simulados({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { userId } = await requireUser();
  const { erro } = await searchParams;
  const [subjects, hist] = await Promise.all([listSubjects(), db.select().from(s.simulados).where(eq(s.simulados.userId, userId)).orderBy(desc(s.simulados.startedAt)).limit(20)]);
  return (
    <>
      <h1 className="text-2xl font-bold">Simulados</h1>
      {erro && <p className="text-sm text-red-600">Nenhuma questão encontrada com esses filtros.</p>}
      <form action={criarSimulado} className="card grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-stone-500 sm:col-span-3">Título<input name="title" className="input mt-0.5" placeholder="Simulado de Física" /></label>
        <label className="text-xs text-stone-500">Etapa<select name="stage" className="input mt-0.5"><option value="">Todas</option><option value="PAS1">PAS 1</option><option value="PAS2">PAS 2</option><option value="PAS3">PAS 3</option></select></label>
        <label className="text-xs text-stone-500">Disciplina<select name="subject" className="input mt-0.5"><option value="">Todas</option>{subjects.map((x) => <option key={x.id} value={x.slug}>{x.name}</option>)}</select></label>
        <label className="text-xs text-stone-500">Nº de itens<input name="count" type="number" min={5} max={120} defaultValue={30} className="input mt-0.5" /></label>
        <fieldset className="text-sm sm:col-span-3"><span className="text-xs text-stone-500">Tipos de item</span>
          <div className="flex gap-4">{["A", "B", "C", "D"].map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" name="itemType" value={t} defaultChecked={t !== "D"} />Tipo {t}</label>)}</div>
        </fieldset>
        <button className="btn btn-primary sm:col-span-3">Gerar simulado</button>
      </form>
      <h2 className="font-semibold">Histórico</h2>
      {hist.map((h) => (
        <Link key={h.id} href={`/simulados/${h.id}`} className="card flex items-center hover:border-blue-600">
          <span>{h.title}</span><span className="ml-auto text-sm text-stone-500">{h.finishedAt ? `${h.result?.raw} pts · ${h.result?.percent.toFixed(0)}%` : "em andamento"}</span>
        </Link>))}
    </>
  );
}
