import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { hideKey, searchQuestions } from "@/lib/queries";
import { excluirLista, removerDaLista } from "@/actions/lists";
import { criarSimulado } from "@/actions/simulados";
import QuestionCard from "@/components/QuestionCard";

export default async function Lista({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await requireUser();
  const [l] = await db.select().from(s.lists).where(and(eq(s.lists.id, Number(id)), eq(s.lists.userId, userId)));
  if (!l) notFound();
  const { items } = await searchQuestions({ listId: l.id, pageSize: 100 });
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{l.name}</h1>
        <form action={criarSimulado} className="ml-auto flex gap-2">
          <input type="hidden" name="listId" value={l.id} /><input type="hidden" name="count" value={Math.max(5, items.length)} /><input type="hidden" name="title" value={`Simulado: ${l.name}`} />
          <button className="btn btn-primary" disabled={!items.length}>Transformar em simulado</button>
        </form>
        <form action={excluirLista.bind(null, l.id)}><button className="btn">Excluir lista</button></form>
      </div>
      {!items.length && <p className="text-stone-500">Lista vazia. Adicione questões em “Questões”.</p>}
      {items.map((q) => <QuestionCard key={q.id} q={hideKey(q)} mode="treino"
        actions={<form action={removerDaLista.bind(null, l.id, q.id)}><button className="btn">Remover</button></form>} />)}
    </>
  );
}
