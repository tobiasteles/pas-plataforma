import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export default async function Cursos({ searchParams }: { searchParams: Promise<{ nota?: string }> }) {
  const { userId } = await requireUser();
  const { nota } = await searchParams;
  const sims = await db.select().from(s.simulados).where(eq(s.simulados.userId, userId)).orderBy(desc(s.simulados.finishedAt)).limit(5);
  const feitos = sims.filter((x) => x.result);
  const auto = feitos.length ? feitos.reduce((t, x) => t + x.result!.percent, 0) / feitos.length : null;
  const meu = nota ? Number(nota) : auto;
  const cursos = await db.select().from(s.courses).orderBy(s.courses.cutoffPercent);
  return (
    <>
      <h1 className="text-2xl font-bold">Quais cursos dá para passar?</h1>
      <form className="card flex flex-wrap items-end gap-2">
        <label className="text-xs text-stone-500">Seu aproveitamento (%)<input name="nota" type="number" step="0.1" min={0} max={100} defaultValue={meu?.toFixed(1)} className="input mt-0.5 w-32" /></label>
        <button className="btn btn-primary">Simular</button>
        <p className="text-xs text-stone-500">{auto !== null ? `Preenchido com a média dos seus últimos ${feitos.length} simulados.` : "Faça um simulado para preencher automaticamente."}</p>
      </form>
      {meu === null || Number.isNaN(meu) ? null : (
        <div className="space-y-2">
          {cursos.map((c) => {
            const d = meu - c.cutoffPercent;
            const st = d >= 5 ? ["Folga", "text-green-600"] : d >= 0 ? ["No limite", "text-amber-600"] : d >= -10 ? ["Perto", "text-orange-600"] : ["Distante", "text-red-600"];
            return (
              <div key={c.id} className="card flex items-center gap-3">
                <div><p className="font-medium">{c.name}</p><p className="text-xs text-stone-500">{c.campus}{c.shift ? ` · ${c.shift}` : ""} · corte {c.year}: {c.cutoffPercent.toFixed(1)}%</p></div>
                <span className={`ml-auto text-sm font-semibold ${st[1]}`}>{st[0]} ({d >= 0 ? "+" : ""}{d.toFixed(1)} p.p.)</span>
              </div>);
          })}
          {!cursos.length && <p className="text-stone-500">O administrador ainda não cadastrou cursos e notas de corte.</p>}
        </div>)}
      <p className="text-xs text-stone-500">Estimativa de treino: compara seu aproveitamento bruto com as notas de corte cadastradas pelo admin. A nota oficial do PAS é padronizada e combina as três etapas, então isso não é previsão de aprovação.</p>
    </>
  );
}
