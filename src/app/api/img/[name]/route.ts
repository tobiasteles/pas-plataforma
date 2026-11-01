import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const [img] = await db.select().from(s.storedImages).where(eq(s.storedImages.name, name));
  if (!img) return new Response("não encontrada", { status: 404 });
  return new Response(Buffer.from(img.data, "base64"), {
    headers: { "content-type": img.mime, "cache-control": "public, max-age=31536000, immutable" },
  });
}
