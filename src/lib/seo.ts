import type { Metadata } from "next";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const NOME = "Triênio";

/** Home: título com a intenção de busca (questões + PAS + UnB), descrição com benefício e escopo. */
export const metadataHome: Metadata = {
  title: { absolute: "Questões do PAS/UnB com resolução e simulados | Triênio" },
  description:
    "Resolva questões do PAS 1, 2 e 3 da UnB por matéria, ano e obra obrigatória. Monte simulados no modelo Cebraspe e acompanhe seu escore. Plataforma independente.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "pt_BR", siteName: NOME, url: "/",
    title: "Questões do PAS e da UnB com resolução e escore",
    description: "Filtre por etapa, matéria e obra, faça simulados no modelo Cebraspe e veja seu escore.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Triênio: questões do PAS/UnB" }],
  },
  twitter: { card: "summary_large_image", title: "Questões do PAS e da UnB com resolução e escore", description: "Simulados no modelo Cebraspe, filtro por obra e escore.", images: ["/og.png"] },
};

type ItemSeo = { id: string; examLabel: string; number: number; text: string; subject?: string; language?: string | null; stage?: string; year?: number };

const limpa = (t: string, n: number) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)) + "…";
};

/** Página de um item: título único (prova + número + matéria), descrição com o começo do enunciado. */
export function metadataItem(i: ItemSeo): Metadata {
  const mat = i.subject ? ` de ${i.subject}` : "";
  const title = `Item ${i.number}${mat}, ${i.examLabel}`;
  const description = limpa(`${i.examLabel}, item ${i.number}${mat}. ${i.text}`, 155);
  const url = `/questao/${i.id}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: "article", locale: "pt_BR", siteName: NOME, url, title, description, images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Dados estruturados da página do item. NÃO inclui a resposta: ela só aparece depois que o aluno responde,
 *  e o marcado precisa refletir o que está visível na página. */
export function jsonLdItem(i: ItemSeo) {
  const url = `${SITE}/questao/${i.id}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "LearningResource",
      "@id": `${url}#item`,
      name: `Item ${i.number}, ${i.examLabel}`,
      description: limpa(i.text, 300),
      inLanguage: i.language ? undefined : "pt-BR",
      learningResourceType: "Questão de prova",
      educationalLevel: "Ensino médio",
      about: i.subject ? { "@type": "Thing", name: i.subject } : undefined,
      isPartOf: { "@type": "Quiz", name: i.examLabel },
      isAccessibleForFree: true,
      url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: SITE },
        { "@type": "ListItem", position: 2, name: "Questões", item: `${SITE}/questoes` },
        { "@type": "ListItem", position: 3, name: i.examLabel, item: `${SITE}/questoes?prova=${encodeURIComponent(i.examLabel)}` },
        { "@type": "ListItem", position: 4, name: `Item ${i.number}`, item: url },
      ],
    },
  ];
}

/** Home: organização e site. */
export const jsonLdHome = [
  { "@context": "https://schema.org", "@type": "Organization", name: NOME, url: SITE, logo: `${SITE}/icon.svg` },
  { "@context": "https://schema.org", "@type": "WebSite", name: NOME, url: SITE, inLanguage: "pt-BR" },
];

/** Como colocar no <head> de uma página (Server Component):
 *   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdItem(x)).replace(/</g, "\\u003c") }} />
 */
