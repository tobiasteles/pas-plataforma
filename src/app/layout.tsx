import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
export const metadata: Metadata = { title: "PAS·Questões", description: "Banco de questões, simulados e escore do PAS/UnB" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="pt-BR"><body><Nav /><main className="mx-auto max-w-5xl space-y-4 p-4">{children}</main></body></html>);
}
