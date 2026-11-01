import Link from "next/link";
import { and, asc, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { excluirQuestao } from "@/actions/crud";
import ConfirmButton from "@/components/ConfirmButton";

const POR_PAGINA = 30;
type SP = Promise<{ q?: string; prova?: string; tipo?: string; filtro?: string; pagina?: string }>;

export default async function AdminQuestoes({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const cond = and(
    sp.q ? or(ilike(s.questions.id, `%${sp.q}%`), ilike(s.questions.text, `%${sp.q}%`)) : undefined,
    sp.prova ? eq(s.questions.examId, Number(sp.prova)) : undefined,
    sp.tipo ? eq(s.questions.itemType, sp.tipo as "A") : undefined,
    sp.filtro === "semgab" ? and(isNull(s.questions.correctAnswer), ne(s.questions.itemType, "D")) : undefined,
    sp.filtro === "rev" ? eq(s.questions.needsReview, true) : undefined,
  );
  const [provas, [{ total }], rows] = await Promise.all([
    db.select().from(s.exams).orderBy(desc(s.exams.year), s.exams.name),
    db.select({ total: sql<number>`count(*)::int` }).from(s.questions).where(cond),
    db.select({ id: s.questions.id, prova: s.questions.examLabel, n: s.questions.number, t: s.questions.itemType, g: s.questions.correctAnswer, rev: s.questions.needsReview, text: s.questions.text })
      .from(s.questions).where(cond).orderBy(desc(s.questions.year), asc(s.questions.examLabel), asc(s.questions.language), asc(s.questions.number))
      .limit(POR_PAGINA).offset((pagina - 1) * POR_PAGINA),
  ]);
  const paginas = Math.ceil(total / POR_PAGINA);
  const href = (p: number) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina") u.set(k, v); u.set("pagina", String(p)); return `?${u}`; };
  const atual = `/admin/questoes${href(pagina)}`;
  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Questões</h1>
        <Link href="/admin/questoes/nova" className="btn btn-primary ml-auto">Nova questão</Link>
      </div>
      <form className="grid gap-2 sm:grid-cols-[1fr_14rem_9rem_10rem_auto]">
        <input name="q" defaultValue={sp.q} className="input" placeholder="Buscar no id ou no enunciado" />
        <select name="prova" defaultValue={sp.prova ?? ""} className="input"><option value="">Todas as provas</option>{provas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select name="tipo" defaultValue={sp.tipo ?? ""} className="input"><option value="">Todos os tipos</option><option value="A">Tipo A</option><option value="B">Tipo B</option><option value="C">Tipo C</option><option value="D">Tipo D</option></select>
        <select name="filtro" defaultValue={sp.filtro ?? ""} className="input"><option value="">Todas</option><option value="semgab">Sem gabarito</option><option value="rev">Para revisar</option></select>
        <button className="btn">Filtrar</button>
      </form>
      <p className="text-sm text-suave">{total} questões</p>
      {rows.map((r) => (
        <div key={r.id} className="card flex items-center gap-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate"><b>{r.prova}, item {r.n}</b> <span className="text-suave">tipo {r.t}</span></p>
            <p className="truncate text-suave">{r.text}</p>
          </div>
          <span className={r.g ? "text-acerto-texto" : "text-suave"}>{r.g ?? "sem gabarito"}</span>
          {r.rev && <span className="tag bg-duvida-fundo text-duvida-texto">revisar</span>}
          <Link href={`/admin/questoes/${encodeURIComponent(r.id)}`} className="btn">Editar</Link>
          <form action={excluirQuestao}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="voltar" value={atual} />
            <ConfirmButton mensagem={`Excluir a questão ${r.id}? As respostas dos alunos nela também serão apagadas.`}>Excluir</ConfirmButton></form>
        </div>))}
      {rows.length === 0 && <p className="text-suave">Nenhuma questão com esses filtros.</p>}
      {paginas > 1 && (
        <div className="flex flex-wrap justify-center gap-1">
          {Array.from({ length: paginas }, (_, i) => i + 1).filter((p) => p === 1 || p === paginas || Math.abs(p - pagina) <= 2)
            .map((p) => <Link key={p} href={href(p)} className={`btn ${p === pagina ? "btn-primary" : ""}`}>{p}</Link>)}
        </div>)}
    </>
  );
}
