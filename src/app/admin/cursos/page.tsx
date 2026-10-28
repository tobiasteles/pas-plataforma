import { requireAdmin } from "@/lib/auth";
import { db, schema as s } from "@/db";
import { salvarCurso, excluirCurso } from "@/actions/admin";

export default async function AdminCursos() {
  await requireAdmin();
  const cursos = await db.select().from(s.courses).orderBy(s.courses.name);
  return (
    <>
      <h1 className="text-2xl font-bold">Cursos e notas de corte</h1>
      <p className="text-xs text-stone-500">Cadastre os números oficiais (fonte: edital/resultado do Cebraspe). A nota de corte é o aproveitamento em % do escore máximo usado na sua comparação.</p>
      <form action={salvarCurso} className="card grid gap-2 sm:grid-cols-3">
        <input name="name" className="input sm:col-span-2" placeholder="Curso (ex.: Medicina)" required /><input name="campus" className="input" defaultValue="Darcy Ribeiro" />
        <input name="shift" className="input" placeholder="Turno" /><input name="year" type="number" className="input" placeholder="Ano" required /><input name="cutoffPercent" type="number" step="0.1" className="input" placeholder="Corte (%)" required />
        <input name="notes" className="input sm:col-span-3" placeholder="Observações" /><button className="btn btn-primary sm:col-span-3">Adicionar</button>
      </form>
      {cursos.map((c) => <form key={c.id} action={excluirCurso.bind(null, c.id)} className="card flex items-center text-sm"><span>{c.name} · {c.year} · {c.cutoffPercent}%</span><button className="btn ml-auto">Excluir</button></form>)}
    </>
  );
}
