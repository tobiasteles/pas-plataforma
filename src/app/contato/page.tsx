import { CONTATO, SITE_NOME } from "@/lib/site";

export const metadata = { title: "Contato", description: `Fale com a equipe do ${SITE_NOME}: dúvidas, correções de questões e pedidos sobre seus dados.` };

export default function Contato() {
  const itens = [
    CONTATO.email && { rotulo: "E-mail", valor: CONTATO.email, href: `mailto:${CONTATO.email}` },
    CONTATO.whatsapp && { rotulo: "WhatsApp", valor: `+${CONTATO.whatsapp}`, href: `https://wa.me/${CONTATO.whatsapp}` },
    CONTATO.cidade && { rotulo: "Cidade", valor: CONTATO.cidade },
    CONTATO.responsavel && { rotulo: "Responsável", valor: CONTATO.responsavel },
  ].filter(Boolean) as { rotulo: string; valor: string; href?: string }[];
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-3xl font-bold">Contato</h1>
      <p className="mt-3 text-suave">Para dúvidas, correções de gabarito ou de enunciado e pedidos sobre seus dados pessoais (veja a Política de Privacidade).</p>
      {itens.length ? (
        <dl className="mt-6 divide-y divide-linha border-y border-linha">
          {itens.map((i) => (
            <div key={i.rotulo} className="grid grid-cols-[8rem_1fr] gap-4 py-4">
              <dt className="text-suave">{i.rotulo}</dt>
              <dd>{i.href ? <a href={i.href} className="font-bold text-azul underline underline-offset-4">{i.valor}</a> : <span className="font-bold">{i.valor}</span>}</dd>
            </div>))}
        </dl>
      ) : <p className="mt-6 rounded-md bg-duvida-fundo p-4 text-sm text-duvida-texto">Os canais de contato ainda não foram configurados.</p>}
    </div>
  );
}
