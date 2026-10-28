import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { criarLista } from "@/actions/lists";

export default async function Listas() {
  const { userId } = await requireUser();
  const rows = await db.select({ id: s.lists.id, name: s.lists.name, n: sql<number>`(select count(*)::int from list_items li where li.list_id = ${s.lists.id})` })
    .from(s.lists).where(eq(s.lists.userId, userId)).orderBy(s.lists.createdAt);
  return (
    <>
      <h1 className="text-2xl font-bold">Minhas listas de exercícios</h1>
      <form action={criarLista} className="flex gap-2"><input name="name" className="input" placeholder="Nome da lista (ex.: Mecânica — revisão)" required /><button className="btn btn-primary">Criar</button></form>
      {rows.map((l) => <Link key={l.id} href={`/listas/${l.id}`} className="card block hover:border-blue-600">{l.name} <span className="tag ml-2">{l.n} questões</span></Link>)}
      {!rows.length && <p className="text-stone-500">Crie uma lista e adicione questões pelo botão “+ lista” na página de questões.</p>}
    </>
  );
}
