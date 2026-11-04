"use client";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { GA_ID } from "@/lib/site";

const CHAVE = "consentimento-analytics";
type Escolha = "sim" | "nao" | null;

/** Google Analytics só carrega depois do "Aceitar". Sem NEXT_PUBLIC_GA_ID, nada disso aparece. */
export default function Analytics() {
  const [escolha, setEscolha] = useState<Escolha | undefined>(undefined);
  useEffect(() => {
    setEscolha((localStorage.getItem(CHAVE) as Escolha) ?? null);
    const reabrir = () => setEscolha(null);
    window.addEventListener("cookies:reabrir", reabrir);
    return () => window.removeEventListener("cookies:reabrir", reabrir);
  }, []);
  if (!GA_ID || escolha === undefined) return null;
  const decidir = (v: "sim" | "nao") => { localStorage.setItem(CHAVE, v); setEscolha(v); };

  return (
    <>
      {escolha === "sim" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}</Script>
        </>)}
      {escolha === null && (
        <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-linha bg-papel p-4 shadow-elevado md:left-4 md:right-auto md:max-w-md">
          <p className="text-sm leading-relaxed">
            Usamos cookies de análise (Google Analytics) para entender como o site é usado. O cookie de login é essencial e funciona sem isso.{" "}
            <Link href="/privacidade#cookies" className="text-azul underline underline-offset-4">Saiba mais</Link>.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn flex-1" onClick={() => decidir("nao")}>Recusar</button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => decidir("sim")}>Aceitar</button>
          </div>
        </div>)}
    </>
  );
}

/** Link do rodapé para mudar a escolha depois. */
export function PreferenciasCookies() {
  if (!GA_ID) return null;
  return (
    <button type="button" className="underline underline-offset-4 hover:text-grafite"
      onClick={() => { localStorage.removeItem(CHAVE); window.dispatchEvent(new Event("cookies:reabrir")); }}>
      Preferências de cookies
    </button>
  );
}
