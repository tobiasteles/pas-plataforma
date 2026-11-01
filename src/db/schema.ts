import {
  pgTable, pgEnum, serial, text, integer, real, boolean, timestamp, jsonb, uuid, primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const stageEnum = pgEnum("stage", ["PAS1", "PAS2", "PAS3"]);
// A = Certo/Errado | B = Numérico (000–999) | C = Múltipla escolha | D = Discursiva
export const itemTypeEnum = pgEnum("item_type", ["A", "B", "C", "D"]);
export const difficultyEnum = pgEnum("difficulty", ["facil", "media", "dificil"]);
export const workTypeEnum = pgEnum("work_type", ["visual", "musical", "literaria", "teatral", "cinema"]);
export const roleEnum = pgEnum("role", ["student", "admin"]);
export const answerStatusEnum = pgEnum("answer_status", ["certeza", "duvida", "branco"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("student"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Texto-base (e figuras) compartilhado por vários itens. */
export const contexts = pgTable("contexts", {
  id: text("id").primaryKey(),
  text: text("text").notNull().default(""),
  images: jsonb("images").$type<string[]>().notNull().default([]),
});

/** Figuras recortadas das provas (base64), servidas por /api/img/[name]. */
export const storedImages = pgTable("stored_images", {
  name: text("name").primaryKey(),
  data: text("data").notNull(),
  mime: text("mime").notNull().default("image/png"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
}, (t) => [uniqueIndex("topics_subject_slug").on(t.subjectId, t.slug)]);

/** Uma prova (ex.: "PAS 1 – Edital 2025"). O nome é o mesmo texto guardado em questions.examLabel. */
export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  year: integer("year").notNull(),
  stage: stageEnum("stage").notNull(),
  subprogram: text("subprogram"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: text("id").primaryKey(), // ex.: PAS1-Edital-2025-q42
  text: text("text").notNull(), // Markdown/HTML
  year: integer("year").notNull(),
  stage: stageEnum("stage").notNull(),
  subprogram: text("subprogram"), // ex.: 2023-2025
  examLabel: text("exam_label").notNull(), // ex.: PAS 1 – Edital 2025
  examId: integer("exam_id").references(() => exams.id, { onDelete: "set null" }),
  number: integer("number").notNull(),
  language: text("language"), // Espanhola | Francesa | Inglesa (itens de língua)
  itemType: itemTypeEnum("item_type").notNull(),
  options: jsonb("options").$type<{ letter: string; text: string }[]>(),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  contextId: text("context_id").references(() => contexts.id, { onDelete: "set null" }),
  correctAnswer: text("correct_answer"), // "C"|"E" | "000".."999" | "A".."D" | espelho de resposta
  explanation: text("explanation"),
  difficulty: difficultyEnum("difficulty"),
  needsReview: boolean("needs_review").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("q_stage_year").on(t.stage, t.year), index("q_type").on(t.itemType)]);

export const questionSubjects = pgTable("question_subjects", {
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.questionId, t.subjectId] })]);

export const questionTopics = pgTable("question_topics", {
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.questionId, t.topicId] })]);

export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  type: workTypeEnum("type").notNull(),
  stage: stageEnum("stage").notNull(),
  summary: text("summary"),
  imageUrl: text("image_url"),
}, (t) => [uniqueIndex("works_title_author").on(t.title, t.author)]);

export const questionWorks = pgTable("question_works", {
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  workId: integer("work_id").notNull().references(() => works.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.questionId, t.workId] })]);

export const simulados = pgTable("simulados", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  result: jsonb("result").$type<import("@/lib/scoring").ScoreResult>(),
});

export const simuladoItems = pgTable("simulado_items", {
  simuladoId: integer("simulado_id").notNull().references(() => simulados.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.simuladoId, t.questionId] })]);

export const userAnswers = pgTable("user_answers", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  simuladoId: integer("simulado_id").references(() => simulados.id, { onDelete: "cascade" }),
  answer: text("answer"), // null = em branco
  status: answerStatusEnum("status").notNull().default("certeza"),
  isCorrect: boolean("is_correct"), // null quando não há gabarito/for discursiva/branco
  scoreDelta: real("score_delta").notNull().default(0),
  timeSpentSec: integer("time_spent_sec").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("ua_user").on(t.userId, t.createdAt), index("ua_question").on(t.questionId)]);

export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const listItems = pgTable("list_items", {
  listId: integer("list_id").notNull().references(() => lists.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.listId, t.questionId] })]);

/** Cursos e notas de corte: cadastrados pelo admin (você mesmo mantém os números oficiais). */
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  campus: text("campus").notNull().default("Darcy Ribeiro"),
  shift: text("shift"),
  year: integer("year").notNull(),
  cutoffPercent: real("cutoff_percent").notNull(), // nota de corte como % do escore máximo (0–100)
  notes: text("notes"),
});

export const questionsRelations = relations(questions, ({ one, many }) => ({
  context: one(contexts, { fields: [questions.contextId], references: [contexts.id] }),
  subjects: many(questionSubjects),
  topics: many(questionTopics),
  works: many(questionWorks),
}));
export const questionSubjectsRelations = relations(questionSubjects, ({ one }) => ({
  question: one(questions, { fields: [questionSubjects.questionId], references: [questions.id] }),
  subject: one(subjects, { fields: [questionSubjects.subjectId], references: [subjects.id] }),
}));
export const questionTopicsRelations = relations(questionTopics, ({ one }) => ({
  question: one(questions, { fields: [questionTopics.questionId], references: [questions.id] }),
  topic: one(topics, { fields: [questionTopics.topicId], references: [topics.id] }),
}));
export const questionWorksRelations = relations(questionWorks, ({ one }) => ({
  question: one(questions, { fields: [questionWorks.questionId], references: [questions.id] }),
  work: one(works, { fields: [questionWorks.workId], references: [works.id] }),
}));
export const worksRelations = relations(works, ({ many }) => ({ questions: many(questionWorks) }));
export const subjectsRelations = relations(subjects, ({ many }) => ({ topics: many(topics) }));
export const topicsRelations = relations(topics, ({ one }) => ({ subject: one(subjects, { fields: [topics.subjectId], references: [subjects.id] }) }));

export type Question = typeof questions.$inferSelect;
export type Work = typeof works.$inferSelect;
