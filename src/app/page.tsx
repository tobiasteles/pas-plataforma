import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

export const revalidate = 3600;

// Coloque sua foto em public/img/estudantes.jpg (horizontal, uns 1600 x 1100 px). Sem ela, a página mostra um item de exemplo.
const TEM_FOTO = existsSync(path.join(process.cwd(), "public", "img", "estudantes.jpg"));

async function numeros() {
  try {
    const [q] = await db.select({ n: sql<number>`count(*)::int` }).from(s.questions);
    const [p] = await db.select({ n: sql<number>`count(distinct exam_label)::int` }).from(s.questions);
    return q.n > 0 ? { itens: q.n, provas: p.n } : null;
  } catch { return null; }
}

const RECURSOS = [
  { titulo: "Questões das provas anteriores", texto: "Filtre por etapa, disciplina, tipo de item e até pela obra obrigatória. Cada item pode trazer gabarito e resolução comentada." },
  { titulo: "Simulados no modelo do Cebraspe", texto: "Marque certo, errado ou deixe em branco. O escore segue a regra da prova: nos itens tipo A, cada erro anula um acerto." },
  { titulo: "Desempenho e cursos", texto: "Veja em quais matérias você mais erra e compare seu aproveitamento com as notas de corte dos cursos." },
];

export default async function Home() {
  const n = await numeros();
  return (
    <div className="-mx-4 space-y-20 pb-6 sm:mx-0">
      {/* ---- apresentação ---- */}
      <section className="grid items-center gap-10 px-4 pt-6 sm:px-0 md:grid-cols-[1.05fr_0.95fr] md:gap-14 md:pt-12">
        <div>
          <h1 className="text-[2.5rem] font-bold leading-[1.08] text-grafite md:text-[3.25rem]">Estude para o PAS resolvendo as provas anteriores</h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-suave">
            O Triênio reúne itens do PAS e da UnB para você praticar por matéria, fazer simulados no modelo do Cebraspe e acompanhar seu escore ao longo dos três anos.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/questoes" className="rounded-lg bg-mata px-5 py-3 text-base font-bold text-papel transition-colors hover:bg-mata-escura active:translate-y-px">Resolver questões</Link>
            <Link href="/cadastrar" className="rounded-lg border border-linha bg-papel px-5 py-3 text-base font-bold text-grafite transition-colors hover:border-mata/50 hover:bg-mata-tinta">Criar conta</Link>
          </div>
          {n && (
            <dl className="mt-10 flex gap-10">
              <div><dt className="text-sm text-suave">Itens no banco</dt><dd className="text-3xl font-bold tabular-nums">{n.itens}</dd></div>
              <div><dt className="text-sm text-suave">Provas</dt><dd className="text-3xl font-bold tabular-nums">{n.provas}</dd></div>
            </dl>)}
        </div>

        {TEM_FOTO ? (
          <img src="/img/estudantes.jpg" alt="Estudantes estudando juntos" width={1600} height={1100}
            className="aspect-[4/3] w-full rounded-xl border border-linha object-cover shadow-elevado" />
        ) : (
          <figure className="rounded-xl bg-azul-tinta p-5 md:p-7" aria-label="Exemplo de item">
            <div className="rounded-xl border border-linha bg-papel p-5 shadow-elevado">
              <p className="flex flex-wrap items-center gap-3 text-sm text-suave">PAS 1 – Edital 2025 <span className="tag">Química</span></p>
              <div className="mt-4 grid grid-cols-[3.5rem_1fr] gap-4">
                <div className="border-r border-linha pr-3"><p className="text-3xl font-bold leading-none tabular-nums">56</p><p className="mt-1 text-xs text-suave">Certo ou errado</p></div>
                <p className="font-leitura text-[1.02rem] leading-[1.7]">O querosene pode ser extraído do petróleo por meio de um processo de separação conhecido como destilação fracionada.</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-base font-bold">
                <span className="rounded-lg border-2 border-mata bg-mata-tinta px-4 py-3 text-mata">Certo</span>
                <span className="rounded-lg border border-linha px-4 py-3 text-suave">Errado</span>
              </div>
            </div>
            <figcaption className="mt-3 text-xs text-suave">Exemplo de como os itens aparecem.</figcaption>
          </figure>
        )}
      </section>

      {/* ---- o que tem aqui ---- */}
      <section className="grid gap-8 px-4 sm:px-0 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
        <h2 className="text-3xl font-bold leading-tight">O que você encontra aqui</h2>
        <ul className="divide-y divide-linha border-y border-linha">
          {RECURSOS.map((r) => (
            <li key={r.titulo} className="py-6">
              <h3 className="text-lg font-bold">{r.titulo}</h3>
              <p className="mt-1.5 max-w-[40rem] leading-relaxed text-suave">{r.texto}</p>
            </li>))}
        </ul>
      </section>

      {/* ---- chamada final ---- */}
      <section className="mx-4 flex flex-wrap items-center gap-6 rounded-xl bg-mata-tinta p-7 sm:mx-0 md:p-10">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold">Comece pelo primeiro simulado</h2>
          <p className="mt-1.5 text-suave">Crie sua conta, escolha a matéria e veja seu escore ao final.</p>
        </div>
        <Link href="/cadastrar" className="rounded-lg bg-mata px-5 py-3 text-base font-bold text-papel transition-colors hover:bg-mata-escura active:translate-y-px">Criar conta</Link>
      </section>
    </div>
  );
}
