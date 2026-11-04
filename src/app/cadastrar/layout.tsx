import type { Metadata } from "next";

export const metadata: Metadata = { title: "Criar conta", description: "Crie sua conta para resolver questões do PAS/UnB, montar listas e fazer simulados.", robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
