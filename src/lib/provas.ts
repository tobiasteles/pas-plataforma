import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Cria as provas (tabela exams) a partir das questões e liga cada questão à sua prova. */
export async function sincronizarProvas() {
  await db.execute(sql`insert into exams (name, year, stage)
    select distinct on (exam_label) exam_label, year, stage from questions where exam_id is null
    on conflict (name) do nothing`);
  await db.execute(sql`update questions q set exam_id = e.id from exams e where q.exam_label = e.name and q.exam_id is null`);
}

/** Apaga textos-base que nenhuma questão usa mais. */
export async function limparContextos() {
  await db.execute(sql`delete from contexts where id not in (select context_id from questions where context_id is not null)`);
}
