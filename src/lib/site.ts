/** Dados públicos do site. Preencha as variáveis NEXT_PUBLIC_* no .env.local (nada é inventado aqui). */
export const SITE_NOME = "Triênio";
export const ATUALIZADO_EM = "2 de novembro de 2026";

const so = (v?: string) => (v ?? "").trim();
export const CONTATO = {
  responsavel: so(process.env.NEXT_PUBLIC_RESPONSAVEL),   // nome da pessoa ou empresa responsável pelo site
  email: so(process.env.NEXT_PUBLIC_CONTATO_EMAIL),
  whatsapp: so(process.env.NEXT_PUBLIC_WHATSAPP).replace(/\D/g, ""), // com DDI e DDD, ex.: 5561999999999
  cidade: so(process.env.NEXT_PUBLIC_CONTATO_CIDADE),     // ex.: Brasília, DF
};
export const GA_ID = /^G-[A-Z0-9]{6,}$/.test(so(process.env.NEXT_PUBLIC_GA_ID)) ? so(process.env.NEXT_PUBLIC_GA_ID) : "";
