/**
 * Calculadora de escore (modelo Cebraspe/PAS).
 *
 * REGRAS — confira com o edital vigente e ajuste SCORING se necessário:
 *  - Tipo A (Certo/Errado): certo +1, errado −1 (um erro anula um acerto), branco 0.
 *  - Tipo B (numérico) e C (múltipla escolha): certo +1, errado 0, branco 0.
 *  - Tipo D (discursiva): corrigida por banca; fica fora do escore bruto automático.
 * O escore final oficial do PAS passa por padronização estatística entre candidatos;
 * aqui calculamos o ESCORE BRUTO, útil para treino e comparação aproximada.
 */
export type ItemType = "A" | "B" | "C" | "D";
export const SCORING: Record<Exclude<ItemType, "D">, { right: number; wrong: number }> = {
  A: { right: 1, wrong: -1 },
  B: { right: 1, wrong: 0 },
  C: { right: 1, wrong: 0 },
};

export type GradedAnswer = {
  itemType: ItemType;
  answer: string | null; // null/"" = em branco
  correct: string | null; // gabarito (null = sem gabarito)
  status?: "certeza" | "duvida" | "branco";
};

export function normalize(itemType: ItemType, v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim().toUpperCase();
  if (!s) return null;
  if (itemType === "B") return /^\d{1,3}$/.test(s) ? s.padStart(3, "0") : null;
  return s;
}

/** Retorna { isCorrect, delta }. isCorrect = null se não dá para corrigir. */
export function gradeOne(a: GradedAnswer): { isCorrect: boolean | null; delta: number } {
  if (a.itemType === "D") return { isCorrect: null, delta: 0 };
  const given = normalize(a.itemType, a.answer);
  if (given === null) return { isCorrect: null, delta: 0 }; // branco
  const key = normalize(a.itemType, a.correct);
  if (key === null) return { isCorrect: null, delta: 0 }; // sem gabarito
  const ok = given === key;
  const rule = SCORING[a.itemType];
  return { isCorrect: ok, delta: ok ? rule.right : rule.wrong };
}

export type TypeBreakdown = { total: number; right: number; wrong: number; blank: number; ungraded: number; points: number };
export type ScoreResult = {
  byType: Record<ItemType, TypeBreakdown>;
  raw: number; // soma dos pontos (pode ser negativa)
  max: number; // pontos máximos possíveis nos itens corrigíveis (A, B, C)
  percent: number; // raw/max*100, mínimo 0
  confidence: { sureWrong: number; doubtRight: number }; // "Tenho certeza" que errou / "Dúvida" que acertou
};

export function computeScore(answers: GradedAnswer[]): ScoreResult {
  const empty = (): TypeBreakdown => ({ total: 0, right: 0, wrong: 0, blank: 0, ungraded: 0, points: 0 });
  const byType: ScoreResult["byType"] = { A: empty(), B: empty(), C: empty(), D: empty() };
  let sureWrong = 0, doubtRight = 0;
  for (const a of answers) {
    const t = byType[a.itemType];
    t.total++;
    if (a.itemType === "D") { t.ungraded++; continue; }
    const given = normalize(a.itemType, a.answer);
    if (given === null) { t.blank++; continue; }
    const g = gradeOne(a);
    if (g.isCorrect === null) { t.ungraded++; continue; }
    if (g.isCorrect) { t.right++; if (a.status === "duvida") doubtRight++; }
    else { t.wrong++; if (a.status === "certeza") sureWrong++; }
    t.points += g.delta;
  }
  const raw = byType.A.points + byType.B.points + byType.C.points;
  // itens respondidos sem gabarito não entram no máximo
  const max = (["A", "B", "C"] as const).reduce((s, k) => s + (byType[k].total - byType[k].ungraded) * SCORING[k].right, 0);
  return { byType, raw, max, percent: max > 0 ? Math.max(0, (raw / max) * 100) : 0, confidence: { sureWrong, doubtRight } };
}
