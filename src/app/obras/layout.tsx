import type { Metadata } from "next";

export const metadata: Metadata = { title: "Obras obrigatórias do PAS", description: "Lista das obras da matriz do PAS/UnB por etapa, com as questões que já cobraram cada uma." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
