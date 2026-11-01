import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { criarQuestao } from "@/actions/crud";
import QuestionForm from "@/components/QuestionForm";

export default async function NovaQuestao({ searchParams }: { searchParams: Promise<{ prova?: string }> }) {
  await requireAdmin();
  const { prova } = await searchParams;
  const [provas, disciplinas, obras] = await Promise.all([
    db.select({ id: s.exams.id, name: s.exams.name }).from(s.exams).orderBy(desc(s.exams.year), s.exams.name),
    db.select({ id: s.subjects.id, name: s.subjects.name }).from(s.subjects).orderBy(asc(s.subjects.name)),
    db.select({ id: s.works.id, title: s.works.title }).from(s.works).orderBy(asc(s.works.title)),
  ]);
  return (
    <>
      <Link href="/admin/questoes" className="text-sm text-azul underline underline-offset-4">Todas as questões</Link>
      <h1 className="text-2xl font-bold">Nova questão</h1>
      {provas.length === 0 && <p className="card text-sm">Cadastre uma prova primeiro, em <Link href="/admin/provas" className="underline">Provas</Link>.</p>}
      <QuestionForm action={criarQuestao} provas={provas} disciplinas={disciplinas} obras={obras}
        inicial={{ itemType: "A", examId: prova ? Number(prova) : null, text: "", options: null, images: [], contextText: "", contextShared: 0, correctAnswer: null, explanation: null, difficulty: null, subjectIds: [], workIds: [], needsReview: false }} />
    </>
  );
}
