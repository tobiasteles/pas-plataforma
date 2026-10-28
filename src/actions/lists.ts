"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";

export async function criarLista(fd: FormData) {
  const { userId } = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const [l] = await db.insert(s.lists).values({ userId, name }).returning();
  redirect(`/listas/${l.id}`);
}

export async function adicionarNaLista(listId: number, questionId: string) {
  const { userId } = await requireUser();
  const [l] = await db.select().from(s.lists).where(and(eq(s.lists.id, listId), eq(s.lists.userId, userId)));
  if (!l) throw new Error("Lista não encontrada");
  await db.insert(s.listItems).values({ listId, questionId }).onConflictDoNothing();
  revalidatePath(`/listas/${listId}`);
}

export async function removerDaLista(listId: number, questionId: string) {
  const { userId } = await requireUser();
  const [l] = await db.select().from(s.lists).where(and(eq(s.lists.id, listId), eq(s.lists.userId, userId)));
  if (!l) return;
  await db.delete(s.listItems).where(and(eq(s.listItems.listId, listId), eq(s.listItems.questionId, questionId)));
  revalidatePath(`/listas/${listId}`);
}

export async function excluirLista(listId: number) {
  const { userId } = await requireUser();
  await db.delete(s.lists).where(and(eq(s.lists.id, listId), eq(s.lists.userId, userId)));
  redirect("/listas");
}
