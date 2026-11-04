import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar", description: "Acesse sua conta para resolver questões, fazer simulados e ver seu desempenho.", robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
