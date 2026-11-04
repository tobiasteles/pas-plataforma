import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hideKey, questionsByIds } from "@/lib/queries";
import { jsonLdItem, metadataItem } from "@/lib/seo";
import ItemCardConectado from "@/components/ItemCardConectado";

type Params = { params: Promise<{ id: string }> };

async function carregar(id: string) {
  const [q] = await questionsByIds([decodeURIComponent(id)]);
  return q ?? null;
}
const dados = (q: NonNullable<Awaited<ReturnType<typeof carregar>>>) => ({
  id: q.id, examLabel: q.examLabel, number: q.number, text: q.text, subject: q.subjects[0]?.name, language: q.language,
});

export async function generateMetadata({ params }: Params) {
  const q = await carregar((await params).id);
  return q ? metadataItem(dados(q)) : { title: "Questão não encontrada" };
}

export default async function PaginaDoItem({ params }: Params) {
  const q = await carregar((await params).id);
  if (!q) notFound();
  const sessao = await getSession();
  const ld = JSON.stringify(jsonLdItem(dados(q))).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <nav aria-label="Você está em" className="text-sm text-suave">
        <Link href="/" className="underline underline-offset-4">Início</Link> / <Link href="/questoes" className="underline underline-offset-4">Questões</Link>
      </nav>
      <h1 className="text-2xl font-bold">Item {q.number}{q.subjects[0] ? ` de ${q.subjects[0].name}` : ""}, {q.examLabel}</h1>

      {sessao ? <ItemCardConectado q={hideKey(q)} /> : (
        <>
          <article className="card space-y-4">
            {q.contextText && <p className="max-w-[68ch] whitespace-pre-line border-l-[3px] border-ipe pl-4 font-leitura leading-[1.75] text-grafite/85">{q.contextText}</p>}
            {q.contextImages.map((src) => <img key={src} src={`/${src}`} alt={`Figura do texto-base do item ${q.number}`} loading="lazy" decoding="async" className="max-w-full rounded-md border border-linha bg-white" />)}
            <p className="max-w-[68ch] whitespace-pre-line font-leitura text-[1.0625rem] leading-[1.75]">{q.text}</p>
            {q.images.map((src) => <img key={src} src={`/${src}`} alt={`Figura do item ${q.number}`} loading="lazy" decoding="async" className="max-w-full rounded-md border border-linha bg-white" />)}
            {q.options && <ol className="space-y-2">{q.options.map((o) => <li key={o.letter} className="flex gap-3 font-leitura"><b className="w-5">{o.letter}</b><span>{o.text}</span></li>)}</ol>}
          </article>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-mata-tinta p-5">
            <p className="min-w-0 flex-1 text-sm">Crie uma conta para responder, ver o gabarito e acompanhar seu escore.</p>
            <Link href="/cadastrar" className="btn btn-primary">Criar conta</Link>
            <Link href="/entrar" className="btn">Entrar</Link>
          </div>
        </>)}
    </>
  );
}
