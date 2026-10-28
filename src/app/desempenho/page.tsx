import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { userStats } from "@/lib/queries";
import ScorePanel from "@/components/ScorePanel";

export default async function Desempenho() {
  const { userId } = await requireUser();
  const [st, sims] = await Promise.all([userStats(userId), db.select().from(s.simulados).where(eq(s.simulados.userId, userId)).orderBy(desc(s.simulados.finishedAt)).limit(10)]);
  const feitos = sims.filter((x) => x.result);
  const media = feitos.length ? feitos.reduce((t, x) => t + x.result!.percent, 0) / feitos.length : null;
  return (
    <>
      <h1 className="text-2xl font-bold">Desempenho</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Respondidas", st.answered], ["Corrigidas", st.graded], ["Acertos", st.correct], ["Tempo (min)", Math.round(st.timeSec / 60)]].map(([k, v]) => (
          <div key={k} className="card"><p className="text-xs text-stone-500">{k}</p><p className="text-2xl font-bold">{v}</p></div>))}
      </div>
      {media !== null && <p className="text-sm">Média dos últimos {feitos.length} simulados: <b>{media.toFixed(1)}%</b> do escore máximo. <a className="underline" href="/cursos">Ver cursos ao seu alcance →</a></p>}
      {feitos[0]?.result && <><h2 className="font-semibold">Último simulado</h2><ScorePanel r={feitos[0].result} /></>}
    </>
  );
}
