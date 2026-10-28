import type { ScoreResult } from "@/lib/scoring";
import { SCORING } from "@/lib/scoring";

const NOME = { A: "Tipo A · Certo/Errado", B: "Tipo B · Numérico", C: "Tipo C · Múltipla escolha", D: "Tipo D · Discursiva" } as const;

/** Painel de desempenho: escore bruto com a regra "um erro anula um acerto" nos itens tipo A. */
export default function ScorePanel({ r }: { r: ScoreResult }) {
  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Escore bruto</p>
          <p className="text-4xl font-bold tabular-nums">{r.raw} <span className="text-lg font-normal text-stone-500">/ {r.max}</span></p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Aproveitamento</p>
          <p className="text-4xl font-bold tabular-nums">{r.percent.toFixed(1)}%</p>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded bg-stone-200 dark:bg-stone-800"><div className="h-full bg-blue-600" style={{ width: `${Math.min(100, r.percent)}%` }} /></div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-stone-500"><th className="py-1">Tipo</th><th>Certos</th><th>Errados</th><th>Brancos</th><th>Pontos</th></tr></thead>
        <tbody>
          {(["A", "B", "C", "D"] as const).map((t) => {
            const b = r.byType[t];
            return b.total === 0 ? null : (
              <tr key={t} className="border-t border-stone-200 dark:border-stone-800">
                <td className="py-1.5">{NOME[t]}</td>
                <td>{t === "D" ? "—" : b.right}</td><td>{t === "D" ? "—" : b.wrong}</td><td>{t === "D" ? "—" : b.blank}</td>
                <td className="font-medium tabular-nums">{t === "D" ? "autocorreção" : b.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-stone-500">
        Tipo A: certo {SCORING.A.right > 0 ? "+" : ""}{SCORING.A.right}, errado {SCORING.A.wrong}, branco 0 — cada erro anula um acerto. Marcar “Tenho certeza” e errar: <b>{r.confidence.sureWrong}</b>; marcar “Dúvida” e acertar: <b>{r.confidence.doubtRight}</b>.
        O escore oficial do PAS é padronizado entre candidatos; este é o escore bruto de treino.
      </p>
    </section>
  );
}
