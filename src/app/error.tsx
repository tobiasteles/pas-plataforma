"use client";
import { useEffect } from "react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-xl py-16" role="alert">
      <h1 className="text-3xl font-bold">Algo deu errado</h1>
      <p className="mt-3 text-suave">Não foi possível carregar esta página. Tente de novo; se continuar, fale com a gente em Contato.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-suave">Código: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">Tentar de novo</button>
        <a href="/" className="btn">Ir para o início</a>
      </div>
    </div>
  );
}
