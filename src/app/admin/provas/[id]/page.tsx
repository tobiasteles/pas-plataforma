import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { excluirProva, excluirQuestao, salvarProva } from "@/actions/crud";
import ProvaForm from "@/components/ProvaForm";
import ConfirmButton from "@/components/ConfirmButton";

export default async function AdminProva({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { erro } = await searchParams;
  const [e] = await db.select().from(s.exams).where(eq(s.exams.id, Number(id)));
  if (!e) notFound();
  const qs = await db.select({ id: s.questions.id, n: s.questions.number, t: s.questions.itemType, g: s.questions.correctAnswer, l: s.questions.language, text: s.questions.text })
    .from(s.questions).where(eq(s.questions.examId, e.id)).orderBy(asc(s.questions.language), asc(s.questions.number));
  const voltar = `/admin/provas/${e.id}`;
  return (
    <>
      <Link href="/admin/provas" className="text-sm text-azul underline underline-offset-4">Todas as provas</Link>
      <h1 className="text-2xl font-bold">{e.name}</h1>
      <ProvaForm action={salvarProva} inicial={{ id: e.id, name: e.name, year: e.year, stage: e.stage, subprogram: e.subprogram, notes: e.notes }} />

      <div className="flex items-center gap-3">
        <h2 className="font-bold">Questões desta prova ({qs.length})</h2>
        <Link href={`/admin/questoes/nova?prova=${e.id}`} className="btn btn-primary ml-auto">Nova questão</Link>
      </div>
      {qs.map((q) => (
        <div key={q.id} className="card flex items-center gap-3 text-sm">
          <b className="w-10 tabular-nums">{q.n}</b>
          <span className="text-suave">{q.l ? `Língua ${q.l}, ` : ""}tipo {q.t}</span>
          <span className="min-w-0 flex-1 truncate">{q.text}</span>
          <span className={q.g ? "text-acerto-texto" : "text-suave"}>{q.g ?? "sem gabarito"}</span>
          <Link href={`/admin/questoes/${encodeURIComponent(q.id)}`} className="btn">Editar</Link>
          <form action={excluirQuestao}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="voltar" value={voltar} />
            <ConfirmButton mensagem={`Excluir a questão ${q.id}?`}>Excluir</ConfirmButton></form>
        </div>))}

      <section className="card space-y-3 border-erro/40">
        <h2 className="font-bold text-erro">Excluir prova</h2>
        {erro === "tem-questoes" && <p role="alert" className="text-sm font-bold text-erro">Esta prova tem questões. Escolha “excluir tudo” ou apague as questões antes.</p>}
        <div className="flex flex-wrap gap-3">
          <form action={excluirProva}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="modo" value="vazia" />
            <ConfirmButton mensagem="Excluir esta prova? (só funciona se ela não tiver questões)">Excluir só a prova</ConfirmButton></form>
          <form action={excluirProva}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="modo" value="tudo" />
            <ConfirmButton mensagem={`Excluir a prova e as ${qs.length} questões dela? As respostas dos alunos nessas questões também serão apagadas. Isso não pode ser desfeito.`} className="btn border-erro text-erro hover:bg-erro-fundo">Excluir prova e todas as questões</ConfirmButton></form>
        </div>
      </section>
    </>
  );
}
