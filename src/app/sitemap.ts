import type { MetadataRoute } from "next";
import { db, schema as s } from "@/db";
import { SITE } from "@/lib/seo";

export const revalidate = 86400; // regera no máximo uma vez por dia

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [qs, ws] = await Promise.all([
    db.select({ id: s.questions.id }).from(s.questions).limit(45000), // limite do formato: 50 mil URLs por sitemap
    db.select({ id: s.works.id }).from(s.works),
  ]);
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/questoes`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/obras`, changeFrequency: "monthly", priority: 0.7 },
    ...ws.map((w) => ({ url: `${SITE}/obras/${w.id}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...qs.map((q) => ({ url: `${SITE}/questao/${q.id}`, changeFrequency: "yearly" as const, priority: 0.5 })),
  ];
}
