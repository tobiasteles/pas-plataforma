import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "@/lib/auth";
import { listSubjects, listWorks, searchQuestions, type QuestionFilters, type QuestionView } from "@/lib/queries";
import QuestionCard from "@/components/QuestionCard";
import AddToList from "@/components/AddToList";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function Questoes({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const types = [sp.tipo].flat().filter(Boolean) as ("A" | "B" | "C" | "D")[];
  const f: QuestionFilters = {
    stage: one(sp.etapa) as QuestionFilters["stage"], subject: one(sp.disciplina), itemType: types.length ? types : undefined,
    topicId: Number(one(sp.topico)) || undefined, workId: Number(one(sp.obra)) || undefined, year: Number(one(sp.ano)) || undefined,
    difficulty: one(sp.dificuldade) as QuestionFilters["difficulty"], q: one(sp.q), page: Number(one(sp.pagina)) || 1,
  };
  const session = await getSession();
  const [res, subjects, works, topics, lists] = await Promise.all([
    searchQuestions(f), listSubjects(), listWorks(),
    db.select({ id: s.topics.id, name: s.topics.name, subject: s.subjects.name }).from(s.topics).innerJoin(s.subjects, eq(s.subjects.id, s.topics.subjectId)).orderBy(asc(s.subjects.name), asc(s.topics.name)),
    session ? db.select({ id: s.lists.id, name: s.lists.name }).from(s.lists).where(eq(s.lists.userId, session.userId)) : Promise.resolve([]),
  ]);
  const pages = Math.ceil(res.total / res.pageSize);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of [v].flat()) if (x && k !== "pagina") u.append(k, x);
    u.set("pagina", String(p));
    return `?${u}`;
  };
  const sel = (name: string, label: string, opts: { v: string | number; l: string }[], cur?: string | number) => (
    <label className="text-xs text-stone-500">{label}
      <select name={name} defaultValue={cur ?? ""} className="input mt-0.5"><option value="">Todas</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
    </label>);
  return (
    <>
      <form className="card grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sel("etapa", "Etapa", [{ v: "PAS1", l: "PAS 1" }, { v: "PAS2", l: "PAS 2" }, { v: "PAS3", l: "PAS 3" }], f.stage)}
        {sel("disciplina", "Disciplina", subjects.map((x) => ({ v: x.slug, l: x.name })), f.subject)}
        {sel("topico", "Tópico", topics.map((t) => ({ v: t.id, l: `${t.subject} · ${t.name}` })), f.topicId)}
        {sel("obra", "Obra obrigatória", works.map((w) => ({ v: w.id, l: `${w.title} (${w.author})` })), f.workId)}
        {sel("ano", "Ano", [2025, 2024, 2023, 2022, 2021].map((y) => ({ v: y, l: String(y) })), f.year)}
        {sel("dificuldade", "Dificuldade", [{ v: "facil", l: "Fácil" }, { v: "media", l: "Média" }, { v: "dificil", l: "Difícil" }], f.difficulty)}
        <fieldset className="text-xs text-stone-500">Tipo de item
          <div className="mt-1 flex gap-3 text-sm text-stone-900 dark:text-stone-100">
            {[["A", "A · C/E"], ["B", "B · Núm."], ["C", "C · Múlt."], ["D", "D · Disc."]].map(([v, l]) => (
              <label key={v} className="flex items-center gap-1"><input type="checkbox" name="tipo" value={v} defaultChecked={types.includes(v as "A")} />{l}</label>))}
          </div>
        </fieldset>
        <label className="text-xs text-stone-500">Buscar<input name="q" defaultValue={f.q} className="input mt-0.5" placeholder="palavra…" /></label>
        <div className="flex items-end gap-2"><button className="btn btn-primary">Filtrar</button><Link href="/questoes" className="btn">Limpar</Link></div>
      </form>

      <p className="text-sm text-stone-500">{res.total} questões</p>
      {res.items.map((q) => session
        ? <QuestionCard key={q.id} q={noKey(q)} mode="treino" actions={<AddToList questionId={q.id} lists={lists} />} />
        : <p key={q.id} className="card whitespace-pre-line text-sm"><span className="tag mr-2">{q.examLabel} · item {q.number}</span>{q.text.slice(0, 280)}{q.text.length > 280 ? "…" : ""}</p>)}
      {!session && <p className="text-sm"><Link href="/cadastrar" className="underline">Crie uma conta</Link> para responder, conferir o gabarito e montar listas.</p>}
      {pages > 1 && (
        <div className="flex flex-wrap justify-center gap-1">
          {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => p === 1 || p === pages || Math.abs(p - res.page) <= 2)
            .map((p) => <Link key={p} href={qs(p)} className={`btn ${p === res.page ? "btn-primary" : ""}`}>{p}</Link>)}
        </div>)}
    </>
  );
}
/** No treino o gabarito só volta DEPOIS de responder (via server action). */
function noKey(q: QuestionView): QuestionView { return { ...q, correctAnswer: null, explanation: null }; }
