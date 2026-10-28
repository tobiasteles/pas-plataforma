import "server-only";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";

export type QuestionFilters = {
  stage?: "PAS1" | "PAS2" | "PAS3";
  subject?: string;      // slug da disciplina
  topicId?: number;
  itemType?: ("A" | "B" | "C" | "D")[];
  workId?: number;
  year?: number;
  difficulty?: "facil" | "media" | "dificil";
  q?: string;
  listId?: number;
  page?: number;
  pageSize?: number;
  random?: boolean;
};

function where(f: QuestionFilters): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (f.stage) c.push(eq(s.questions.stage, f.stage));
  if (f.year) c.push(eq(s.questions.year, f.year));
  if (f.difficulty) c.push(eq(s.questions.difficulty, f.difficulty));
  if (f.itemType?.length) c.push(inArray(s.questions.itemType, f.itemType));
  if (f.q) c.push(or(ilike(s.questions.text, `%${f.q}%`), ilike(sql`coalesce(${s.contexts.text}, '')`, `%${f.q}%`)));
  if (f.subject)
    c.push(exists(db.select({ x: sql`1` }).from(s.questionSubjects).innerJoin(s.subjects, eq(s.subjects.id, s.questionSubjects.subjectId))
      .where(and(eq(s.questionSubjects.questionId, s.questions.id), eq(s.subjects.slug, f.subject)))));
  if (f.topicId)
    c.push(exists(db.select({ x: sql`1` }).from(s.questionTopics)
      .where(and(eq(s.questionTopics.questionId, s.questions.id), eq(s.questionTopics.topicId, f.topicId)))));
  if (f.workId)
    c.push(exists(db.select({ x: sql`1` }).from(s.questionWorks)
      .where(and(eq(s.questionWorks.questionId, s.questions.id), eq(s.questionWorks.workId, f.workId)))));
  if (f.listId)
    c.push(exists(db.select({ x: sql`1` }).from(s.listItems)
      .where(and(eq(s.listItems.questionId, s.questions.id), eq(s.listItems.listId, f.listId)))));
  return and(...c);
}

/** Questões com contexto, disciplinas e obras, aplicando filtros dinâmicos. */
export async function searchQuestions(f: QuestionFilters) {
  const pageSize = f.pageSize ?? 20;
  const page = Math.max(1, f.page ?? 1);
  const w = where(f);
  const base = db.select({ q: s.questions, ctx: s.contexts }).from(s.questions).leftJoin(s.contexts, eq(s.contexts.id, s.questions.contextId)).where(w);
  const rows = await (f.random ? base.orderBy(sql`random()`) : base.orderBy(desc(s.questions.year), asc(s.questions.examLabel), asc(s.questions.language), asc(s.questions.number)))
    .limit(pageSize).offset((page - 1) * pageSize);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.questions).leftJoin(s.contexts, eq(s.contexts.id, s.questions.contextId)).where(w);
  return { items: await hydrate(rows), total: count, page, pageSize };
}

export async function questionsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select({ q: s.questions, ctx: s.contexts }).from(s.questions).leftJoin(s.contexts, eq(s.contexts.id, s.questions.contextId)).where(inArray(s.questions.id, ids));
  const h = await hydrate(rows);
  return ids.map((id) => h.find((x) => x.id === id)).filter(Boolean) as typeof h;
}

async function hydrate(rows: { q: typeof s.questions.$inferSelect; ctx: typeof s.contexts.$inferSelect | null }[]) {
  const ids = rows.map((r) => r.q.id);
  if (!ids.length) return [];
  const [subs, wks] = await Promise.all([
    db.select({ qid: s.questionSubjects.questionId, name: s.subjects.name, slug: s.subjects.slug }).from(s.questionSubjects)
      .innerJoin(s.subjects, eq(s.subjects.id, s.questionSubjects.subjectId)).where(inArray(s.questionSubjects.questionId, ids)),
    db.select({ qid: s.questionWorks.questionId, id: s.works.id, title: s.works.title }).from(s.questionWorks)
      .innerJoin(s.works, eq(s.works.id, s.questionWorks.workId)).where(inArray(s.questionWorks.questionId, ids)),
  ]);
  return rows.map(({ q, ctx }) => ({
    ...q,
    contextText: ctx?.text ?? "",
    contextImages: ctx?.images ?? [],
    subjects: subs.filter((x) => x.qid === q.id).map(({ name, slug }) => ({ name, slug })),
    works: wks.filter((x) => x.qid === q.id).map(({ id, title }) => ({ id, title })),
  }));
}
export type QuestionView = Awaited<ReturnType<typeof hydrate>>[number];

/** Remove o gabarito antes de mandar a questão ao navegador (modo prova). */
export function hideKey(q: QuestionView): QuestionView {
  return { ...q, correctAnswer: null, explanation: null };
}

export const listSubjects = () => db.select().from(s.subjects).orderBy(asc(s.subjects.name));
export const listWorks = () => db.select().from(s.works).orderBy(asc(s.works.stage), asc(s.works.type), asc(s.works.title));

export async function userStats(userId: string) {
  const rows = await db.select().from(s.userAnswers).where(eq(s.userAnswers.userId, userId));
  const graded = rows.filter((r) => r.isCorrect !== null);
  return {
    answered: rows.length,
    correct: graded.filter((r) => r.isCorrect).length,
    graded: graded.length,
    timeSec: rows.reduce((t, r) => t + r.timeSpentSec, 0),
  };
}
