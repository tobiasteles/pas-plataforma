import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [w] = await db.select().from(s.works).where(eq(s.works.id, Number(await params.then((p) => p.id)) || 0));
  if (!w) return { title: "Obra não encontrada" };
  return {
    title: `${w.title}, ${w.author}`,
    description: (w.summary ?? `Questões do PAS que cobraram ${w.title}, de ${w.author}.`).replace(/\s+/g, " ").slice(0, 155),
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
