import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ImportGabaritos, ImportJson, UploadProvas } from "@/components/AdminForms";

export default async function Admin() {
  await requireAdmin();
  const [c] = await db.select({ q: sql<number>`count(*)::int`, semGab: sql<number>`count(*) filter (where correct_answer is null and item_type <> 'D')::int`, rev: sql<number>`count(*) filter (where needs_review)::int` }).from(s.questions);
  const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(s.users);
  return (
    <>
      <h1 className="text-2xl font-bold">Administração</h1>
      <p className="text-sm text-suave">{c.q} questões, {c.semGab} sem gabarito, {c.rev} para revisar, {u.n} usuários</p>
      <div className="flex flex-wrap gap-2">
        <Link className="btn" href="/admin/provas">Provas</Link><Link className="btn" href="/admin/questoes">Questões</Link>
        <Link className="btn" href="/admin/obras">Obras</Link><Link className="btn" href="/admin/cursos">Cursos e notas de corte</Link>
      </div>
      <UploadProvas /><ImportGabaritos /><ImportJson />
    </>
  );
}
