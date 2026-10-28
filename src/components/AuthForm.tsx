"use client";
import { useActionState } from "react";
import type { FormState } from "@/actions/auth";

export default function AuthForm({ action, cadastro }: { action: (s: FormState, f: FormData) => Promise<FormState>; cadastro?: boolean }) {
  const [st, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="card mx-auto max-w-sm space-y-3">
      <h1 className="text-xl font-bold">{cadastro ? "Criar conta" : "Entrar"}</h1>
      {cadastro && <input name="name" className="input" placeholder="Nome" required />}
      <input name="email" type="email" className="input" placeholder="E-mail" required />
      <input name="password" type="password" className="input" placeholder="Senha (8+ caracteres)" required minLength={cadastro ? 8 : 1} />
      {st?.error && <p className="text-sm text-red-600">{st.error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>{cadastro ? "Cadastrar" : "Entrar"}</button>
    </form>
  );
}
