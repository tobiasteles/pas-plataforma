"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { checkPassword, createSession, destroySession, hashPassword } from "@/lib/auth";

export type FormState = { error?: string } | undefined;

export async function cadastrar(_: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
    return { error: "Preencha nome, e-mail válido e senha com 8+ caracteres." };
  const [exists] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email));
  if (exists) return { error: "Este e-mail já está cadastrado." };
  const role = process.env.ADMIN_EMAIL?.toLowerCase() === email ? "admin" : "student";
  const [u] = await db.insert(s.users).values({ name, email, passwordHash: await hashPassword(password), role }).returning();
  await createSession({ userId: u.id, role: u.role, name: u.name });
  redirect("/questoes");
}

export async function entrar(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (!u || !(await checkPassword(String(fd.get("password") ?? ""), u.passwordHash))) return { error: "E-mail ou senha incorretos." };
  await createSession({ userId: u.id, role: u.role, name: u.name });
  redirect("/questoes");
}

export async function sair() { await destroySession(); redirect("/"); }
