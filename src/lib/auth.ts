import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

const COOKIE = "session";
const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET não definida");
  return new TextEncoder().encode(secret ?? "dev-inseguro");
};

export type Session = { userId: string; role: "student" | "admin"; name: string };

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, key()); return payload as unknown as Session; } catch { return null; }
}
export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/entrar");
  return s;
}
export async function requireAdmin(): Promise<Session> {
  const s = await requireUser();
  if (s.role !== "admin") redirect("/");
  return s;
}
