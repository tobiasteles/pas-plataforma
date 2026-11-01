import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { criarProva, sincronizarProvasAcao } from "@/actions/crud";
import ProvaForm from "@/components/ProvaForm";

export default async function AdminProvas() {
  await requireAdmin();
  const provas = await db.select({ e: s.exams, n: sql<number>`(select count(*)::int from questions where questions.exam_id = ${s.exams.id})` })
    .from(s.exams).orderBy(desc(s.exams.year), s.exams.name);
  const [{ soltas }] = await db.select({ soltas: sql<number>`count(*)::int` }).from(s.questions).where(sql`exam_id is null`);
  return (
    <>
      <h1 className="text-2xl font-bold">Provas</h1>
      {soltas > 0 && (
        <form action={sincronizarProvasAcao} className="card flex flex-wrap items-center gap-3 text-sm">
          <p>{soltas} questões ainda não estão ligadas a uma prova (importadas antes desta tela existir).</p>
          <button className="btn btn-primary ml-auto">Criar provas a partir delas</button>
        </form>
      )}
      <h2 className="font-bold">Nova prova</h2>
      <ProvaForm action={criarProva} />
      <h2 className="font-bold">Provas cadastradas</h2>
      {provas.length === 0 && <p className="text-sm text-suave">Nenhuma prova ainda.</p>}
      {provas.map(({ e, n }) => (
        <Link key={e.id} href={`/admin/provas/${e.id}`} className="card flex items-center gap-3 hover:border-mata/50">
          <span className="font-bold">{e.name}</span>
          <span className="text-sm text-suave">{e.stage.replace("PAS", "PAS ")}, {e.year}</span>
          <span className="tag ml-auto">{n} questões</span>
        </Link>))}
    </>
  );
}
