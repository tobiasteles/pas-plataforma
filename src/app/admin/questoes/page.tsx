import Link from "next/link";
import { and, desc, eq, ilike, isNull, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";

export default async function AdminQuestoes({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  await requireAdmin();
  const { q, filtro } = await searchParams;
  const rows = await db.select({ id: s.questions.id, label: s.questions.examLabel, n: s.questions.number, t: s.questions.itemType, g: s.questions.correctAnswer, rev: s.questions.needsReview })
    .from(s.questions).where(and(q ? ilike(s.questions.id, `%${q}%`) : undefined,
      filtro === "semgab" ? and(isNull(s.questions.correctAnswer), ne(s.questions.itemType, "D")) : undefined, filtro === "rev" ? eq(s.questions.needsReview, true) : undefined))
    .orderBy(desc(s.questions.year), s.questions.id).limit(200);
  return (
    <>
      <h1 className="text-2xl font-bold">Questões</h1>
      <form className="flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="id contém…" />
        <select name="filtro" defaultValue={filtro ?? ""} className="input w-auto"><option value="">todas</option><option value="semgab">sem gabarito</option><option value="rev">revisar</option></select><button className="btn">Filtrar</button></form>
      {rows.map((r) => <Link key={r.id} href={`/admin/questoes/${r.id}`} className="card flex gap-3 text-sm hover:border-blue-600"><span className="font-mono">{r.id}</span><span className="text-stone-500">{r.label} · {r.t}</span><span className="ml-auto">{r.g ?? "sem gabarito"}{r.rev ? " ⚠" : ""}</span></Link>)}
    </>
  );
}
