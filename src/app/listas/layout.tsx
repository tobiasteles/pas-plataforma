import type { Metadata } from "next";

export const metadata: Metadata = { title: "Listas de exercícios", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
