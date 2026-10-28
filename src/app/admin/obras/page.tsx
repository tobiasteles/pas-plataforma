import { requireAdmin } from "@/lib/auth";
import { listWorks } from "@/lib/queries";
import { criarObra, excluirObra } from "@/actions/admin";

export default async function AdminObras() {
  await requireAdmin();
  const works = await listWorks();
  return (
    <>
      <h1 className="text-2xl font-bold">Obras obrigatórias</h1>
      <form action={criarObra} className="card grid gap-2 sm:grid-cols-2">
        <input name="title" className="input" placeholder="Título" required /><input name="author" className="input" placeholder="Autor/Artista" required />
        <select name="type" className="input"><option value="literaria">Literária</option><option value="visual">Visual</option><option value="musical">Musical</option><option value="teatral">Teatral</option><option value="cinema">Cinema</option></select>
        <select name="stage" className="input"><option value="PAS1">PAS 1</option><option value="PAS2">PAS 2</option><option value="PAS3">PAS 3</option></select>
        <input name="imageUrl" className="input sm:col-span-2" placeholder="URL da imagem (opcional)" />
        <textarea name="summary" rows={3} className="input sm:col-span-2" placeholder="Resumo / perfil da obra" />
        <button className="btn btn-primary sm:col-span-2">Adicionar obra</button>
      </form>
      {works.map((w) => <form key={w.id} action={excluirObra.bind(null, w.id)} className="card flex items-center text-sm"><span>{w.title} — {w.author} <span className="tag ml-2">{w.type} · {w.stage}</span></span><button className="btn ml-auto">Excluir</button></form>)}
    </>
  );
}
