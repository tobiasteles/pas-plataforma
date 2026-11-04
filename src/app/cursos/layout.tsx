import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cursos e notas de corte", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
