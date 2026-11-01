import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { atualizarQuestao, excluirQuestao } from "@/actions/crud";
import QuestionForm from "@/components/QuestionForm";
import ConfirmButton from "@/components/ConfirmButton";

export default async function EditarQuestao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  await requireAdmin();
  const id = decodeURIComponent((await params).id);
  const { criada } = await searchParams;
  const [q] = await db.select().from(s.questions).where(eq(s.questions.id, id));
  if (!q) notFound();
  const [provas, disciplinas, obras, subs, wks, ctx] = await Promise.all([
    db.select({ id: s.exams.id, name: s.exams.name }).from(s.exams).orderBy(desc(s.exams.year), s.exams.name),
    db.select({ id: s.subjects.id, name: s.subjects.name }).from(s.subjects).orderBy(asc(s.subjects.name)),
    db.select({ id: s.works.id, title: s.works.title }).from(s.works).orderBy(asc(s.works.title)),
    db.select().from(s.questionSubjects).where(eq(s.questionSubjects.questionId, id)),
    db.select().from(s.questionWorks).where(eq(s.questionWorks.questionId, id)),
    q.contextId ? db.select({ text: s.contexts.text, n: sql<number>`(select count(*)::int from questions where context_id = ${q.contextId})` }).from(s.contexts).where(eq(s.contexts.id, q.contextId)) : Promise.resolve([]),
  ]);
  return (
    <>
      <Link href="/admin/questoes" className="text-sm text-azul underline underline-offset-4">Todas as questões</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{q.examLabel}, item {q.number}</h1>
        <form action={excluirQuestao} className="ml-auto"><input type="hidden" name="id" value={q.id} />
          <ConfirmButton mensagem="Excluir esta questão? As respostas dos alunos nela também serão apagadas.">Excluir questão</ConfirmButton></form>
      </div>
      <p className="font-mono text-xs text-suave">{q.id}</p>
      {criada && <p role="status" className="text-sm font-bold text-acerto-texto">Questão criada.</p>}
      <QuestionForm action={atualizarQuestao} provas={provas} disciplinas={disciplinas} obras={obras}
        inicial={{
          id: q.id, examId: q.examId, number: q.number, language: q.language, itemType: q.itemType, text: q.text, options: q.options, images: q.images,
          contextText: ctx[0]?.text ?? "", contextShared: ctx[0]?.n ?? 0, correctAnswer: q.correctAnswer, explanation: q.explanation, difficulty: q.difficulty,
          subjectIds: subs.map((x) => x.subjectId), workIds: wks.map((x) => x.workId), needsReview: q.needsReview,
        }} />
    </>
  );
}
