import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "@/lib/auth";
import { hideKey, searchQuestions } from "@/lib/queries";
import QuestionCard from "@/components/QuestionCard";

export default async function Obra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [w] = await db.select().from(s.works).where(eq(s.works.id, Number(id)));
  if (!w) notFound();
  const session = await getSession();
  const { items, total } = await searchQuestions({ workId: w.id, pageSize: 50 });
  return (
    <>
      <Link href="/obras" className="text-sm text-blue-600">← todas as obras</Link>
      <section className="card flex gap-4">
        {w.imageUrl && <img src={w.imageUrl} alt={w.title} className="h-32 w-32 rounded object-cover" />}
        <div>
          <h1 className="text-2xl font-bold">{w.title}</h1>
          <p className="text-stone-500">{w.author} · {w.type} · {w.stage.replace("PAS", "PAS ")}</p>
          {w.summary && <p className="mt-2 whitespace-pre-line">{w.summary}</p>}
        </div>
      </section>
      <h2 className="font-semibold">{total} questões do PAS que cobraram esta obra</h2>
      {items.map((q) => session
        ? <QuestionCard key={q.id} q={hideKey(q)} mode="treino" />
        : <p key={q.id} className="card text-sm">{q.examLabel} · item {q.number}: {q.text.slice(0, 200)}…</p>)}
    </>
  );
}
