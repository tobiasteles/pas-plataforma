import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible, Literata } from "next/font/google";
import Nav from "@/components/Nav";
import Analytics, { PreferenciasCookies } from "@/components/Analytics";
import WhatsAppFlutuante from "@/components/WhatsAppFlutuante";

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
        <footer className="mx-auto mt-10 max-w-5xl border-t border-linha px-4 pb-24 pt-6 text-sm text-suave md:pb-10">
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/contato" className="underline-offset-4 hover:text-grafite hover:underline">Contato</Link>
            <Link href="/termos" className="underline-offset-4 hover:text-grafite hover:underline">Termos de Uso</Link>
            <Link href="/privacidade" className="underline-offset-4 hover:text-grafite hover:underline">Política de Privacidade</Link>
            <PreferenciasCookies />
          </nav>
          <p className="mt-4 max-w-2xl text-xs">Triênio é uma plataforma independente de estudos. Não tem vínculo com a Universidade de Brasília nem com o Cebraspe.</p>
        </footer>
        <WhatsAppFlutuante />
        <Analytics />
      </body>
    </html>
  );
}
