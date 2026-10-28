import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { listWorks, questionsByIds } from "@/lib/queries";
import { salvarQuestao } from "@/actions/admin";
import QuestionCard from "@/components/QuestionCard";

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = decodeURIComponent((await params).id);
  const [q] = await questionsByIds([id]);
  if (!q) notFound();
  const [works, linked] = await Promise.all([listWorks(), db.select().from(s.questionWorks).where(eq(s.questionWorks.questionId, id))]);
  const set = new Set(linked.map((l) => l.workId));
  return (
    <>
      <QuestionCard q={{ ...q, correctAnswer: null, explanation: null }} mode="prova" />
      <form action={salvarQuestao} className="card space-y-3">
        <input type="hidden" name="id" value={q.id} />
        <label className="block text-xs text-stone-500">Gabarito ({q.itemType === "A" ? "C ou E" : q.itemType === "B" ? "000–999" : q.itemType === "C" ? "A–D" : "espelho de resposta"})
          {q.itemType === "D" ? <textarea name="correctAnswer" rows={4} defaultValue={q.correctAnswer ?? ""} className="input mt-0.5" /> : <input name="correctAnswer" defaultValue={q.correctAnswer ?? ""} className="input mt-0.5 w-32" />}</label>
        <label className="block text-xs text-stone-500">Resolução comentada<textarea name="explanation" rows={5} defaultValue={q.explanation ?? ""} className="input mt-0.5" /></label>
        <label className="block text-xs text-stone-500">Dificuldade<select name="difficulty" defaultValue={q.difficulty ?? ""} className="input mt-0.5 w-40"><option value="">—</option><option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option></select></label>
        <fieldset className="text-sm"><span className="text-xs text-stone-500">Obras citadas</span>
          <div className="grid gap-1 sm:grid-cols-2">{works.map((w) => <label key={w.id} className="flex items-center gap-1"><input type="checkbox" name="workId" value={w.id} defaultChecked={set.has(w.id)} />{w.title}</label>)}</div></fieldset>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="needsReview" defaultChecked={q.needsReview} /> marcar como “revisar”</label>
        <button className="btn btn-primary">Salvar</button>
      </form>
    </>
  );
}
