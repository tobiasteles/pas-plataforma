import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { hideKey, questionsByIds } from "@/lib/queries";
import SimuladoRunner from "@/components/SimuladoRunner";
import ScorePanel from "@/components/ScorePanel";

export default async function Simulado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireUser();
  const [sim] = await db.select().from(s.simulados).where(and(eq(s.simulados.id, Number(id)), eq(s.simulados.userId, userId)));
  if (!sim) notFound();
  const ids = (await db.select().from(s.simuladoItems).where(eq(s.simuladoItems.simuladoId, sim.id)).orderBy(asc(s.simuladoItems.position))).map((x) => x.questionId);
  const qs = await questionsByIds(ids);

  if (!sim.finishedAt) return (<><h1 className="text-2xl font-bold">{sim.title}</h1><SimuladoRunner simuladoId={sim.id} questions={qs.map(hideKey)} /></>);

  const ans = await db.select().from(s.userAnswers).where(eq(s.userAnswers.simuladoId, sim.id));
  return (
    <>
      <h1 className="text-2xl font-bold">{sim.title}</h1>
      <ScorePanel r={sim.result!} />
      <h2 className="font-semibold">Correção</h2>
      {qs.map((q) => {
        const a = ans.find((x) => x.questionId === q.id);
        return (
          <div key={q.id} className="card space-y-1 text-sm">
            <p className="whitespace-pre-line"><b>{q.number}.</b> {q.text}</p>
            <p>Sua resposta: <b>{a?.answer ?? "em branco"}</b> · Gabarito: <b>{q.correctAnswer ?? "—"}</b> ·{" "}
              {a?.isCorrect === true ? <span className="text-green-600">acertou (+{a.scoreDelta})</span> : a?.isCorrect === false ? <span className="text-red-600">errou ({a.scoreDelta})</span> : "sem pontuação"}</p>
            {q.explanation && <p className="whitespace-pre-line text-stone-500">{q.explanation}</p>}
          </div>);
      })}
    </>
  );
}
