"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/actions/auth";

export default function AuthForm({ action, cadastro }: { action: (s: FormState, f: FormData) => Promise<FormState>; cadastro?: boolean }) {
  const [st, run, pendente] = useActionState(action, undefined);
  return (
    <form action={run} className="card mx-auto max-w-sm space-y-3" aria-busy={pendente}>
      <h1 className="text-xl font-bold">{cadastro ? "Criar conta" : "Entrar"}</h1>
      {cadastro && <input name="name" className="input" placeholder="Nome" autoComplete="name" required />}
      <input name="email" type="email" className="input" placeholder="E-mail" autoComplete="email" required />
      <input name="password" type="password" className="input" placeholder={cadastro ? "Senha (8 ou mais caracteres)" : "Senha"} autoComplete={cadastro ? "new-password" : "current-password"} required minLength={cadastro ? 8 : 1} />
      {cadastro && (
        <label className="flex items-start gap-2 text-sm text-suave">
          <input type="checkbox" name="aceite" className="mt-1" required />
          <span>Li e aceito os <Link href="/termos" className="text-azul underline underline-offset-4">Termos de Uso</Link> e a <Link href="/privacidade" className="text-azul underline underline-offset-4">Política de Privacidade</Link>.</span>
        </label>)}
      <div aria-live="polite">{st?.error && <p role="alert" className="rounded-md bg-erro-fundo px-3 py-2 text-sm font-bold text-erro">{st.error}</p>}</div>
      <button className="btn btn-primary w-full" disabled={pendente}>
        {pendente ? (cadastro ? "Criando conta…" : "Entrando…") : cadastro ? "Criar conta" : "Entrar"}
      </button>
      <p className="text-center text-sm text-suave">
        {cadastro ? <>Já tem conta? <Link href="/entrar" className="text-azul underline underline-offset-4">Entrar</Link></> : <>Ainda não tem conta? <Link href="/cadastrar" className="text-azul underline underline-offset-4">Criar conta</Link></>}
      </p>
    </form>
  );
}
