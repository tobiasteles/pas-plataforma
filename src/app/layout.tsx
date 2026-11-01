import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Literata } from "next/font/google";
import Nav from "@/components/Nav";

// UI: Atkinson Hyperlegible (desenhada para máxima legibilidade). Textos de prova: Literata (desenhada para leitura longa).
const ui = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-ui", display: "swap" });
const leitura = Literata({ subsets: ["latin"], variable: "--font-leitura", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Triênio: questões do PAS e da UnB com resolução e escore", template: "%s | Triênio" },
  description:
    "Resolva questões do PAS/UnB por etapa, matéria e obra, monte simulados no modelo Cebraspe e acompanhe seu escore. Plataforma independente, sem vínculo com a UnB ou o Cebraspe.",
  applicationName: "Triênio",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Triênio", url: "/", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Triênio, questões do PAS/UnB" }] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#EDF3EE" }, { media: "(prefers-color-scheme: dark)", color: "#0E1613" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${ui.variable} ${leitura.variable}`}>
      <body>
        <Nav />
        <main className="mx-auto max-w-5xl space-y-4 p-4">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 pt-6 text-xs text-suave">
          Triênio é uma plataforma independente de estudos. Não tem vínculo com a Universidade de Brasília nem com o Cebraspe.
        </footer>
      </body>
    </html>
  );
}
