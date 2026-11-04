import type { Metadata } from "next";

export const metadata: Metadata = { title: "Questões do PAS e da UnB por matéria, etapa e obra", description: "Resolva itens de provas anteriores do PAS 1, 2 e 3 da UnB. Filtre por disciplina, tipo de item, ano e obra obrigatória." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
