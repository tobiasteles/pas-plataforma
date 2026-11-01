"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { Bookmark, BookmarkCheck, BookOpen, Flag, Lightbulb, Lock, MessageSquare, Scale, Scissors, ShieldCheck, Timer } from "lucide-react";

/* ------------------------------------------------------------------ tipos */
export type ItemType = "A" | "B" | "C" | "D"; // A certo/errado, B numérico (000–999), C múltipla escolha, D discursiva
export type Confidence = "certeza" | "duvida";

export type ItemData = {
  id: string;
  examLabel: string; // ex.: "PAS 1 – Edital 2025"
  number: number;
  language?: string | null;
  itemType: ItemType;
  text: string;
  options?: { letter: string; text: string }[] | null;
  contextText?: string;
  contextImages?: string[];
  images?: string[];
  subjects?: { name: string; slug: string }[];
  works?: { id: number; title: string }[];
  difficulty?: "facil" | "media" | "dificil" | null;
};

export type Submission = { answer: string | null; confidence: Confidence; timeSpentSec: number };
export type Feedback = {
  isCorrect: boolean | null; // null: em branco, sem gabarito ou discursiva
  delta: number;
  correctAnswer: string | null;
  explanation: string | null;
  percentCorrect?: number; // % de alunos que acertaram (opcional)
};

type Props = {
  item: ItemData;
  /** Corrige no servidor e devolve o feedback. O gabarito não precisa estar no navegador antes. */
  onSubmit: (s: Submission) => Promise<Feedback>;
  saved?: boolean;
  onToggleSave?: (next: boolean) => void;
  onReport?: () => void;
  comments?: ReactNode;
  commentsCount?: number;
};

/* ---------------------------------------------------------------- helpers */
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const TIPO: Record<ItemType, string> = { A: "Certo ou errado", B: "Resposta numérica", C: "Múltipla escolha", D: "Discursiva" };
const DIFICULDADE = { facil: "Fácil", media: "Média", dificil: "Difícil" } as const;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const nomeGabarito = (t: ItemType, k: string | null) => (t === "A" ? (k === "C" ? "Certo" : k === "E" ? "Errado" : k) : k);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

function useStopwatch(running: boolean) {
  const start = useRef(Date.now());
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec(Math.floor((Date.now() - start.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return { sec, read: () => Math.floor((Date.now() - start.current) / 1000) };
}

/** A marca de correção na margem, desenhada como a de um professor corrigindo a prova. */
function MarcaDeCorrecao({ tipo, reduzido }: { tipo: "ok" | "erro" | "branco"; reduzido: boolean }) {
  const [desenhada, setDesenhada] = useState(reduzido);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDesenhada(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const d = tipo === "ok" ? "M6 21 L16 31 L34 9" : tipo === "erro" ? "M9 9 L31 31 M31 9 L9 31" : "M10 20 H30";
  const cor = tipo === "ok" ? "text-acerto" : tipo === "erro" ? "text-erro" : "text-suave";
  return (
    <svg viewBox="0 0 40 40" className={cx("h-10 w-10", cor)} aria-hidden="true">
      <path
        d={d} pathLength={1} fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 1, strokeDashoffset: desenhada ? 0 : 1, transition: reduzido ? "none" : "stroke-dashoffset 420ms cubic-bezier(.3,.7,.2,1)" }}
      />
    </svg>
  );
}

/** Painel que abre e fecha animando a altura (sem JS de medição). */
function Painel({ aberto, children }: { aberto: boolean; children: ReactNode }) {
  return (
    <div className={cx("grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none", aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className={cx("overflow-hidden", aberto ? "visible" : "invisible")}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- componente */
export default function ItemCard({ item, onSubmit, saved = false, onToggleSave, onReport, comments, commentsCount }: Props) {
  const reduzido = useReducedMotion();
  const [resposta, setResposta] = useState<string | null>(null); // A: "C"/"E" · C: "A".."D" · D: texto
  const [digitos, setDigitos] = useState(["", "", ""]); // B
  const [riscadas, setRiscadas] = useState<Record<string, boolean>>({});
  const [confianca, setConfianca] = useState<Confidence>("certeza");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"resolucao" | "comentarios" | null>(null);
  const [textoAberto, setTextoAberto] = useState(false);
  const [tempoFinal, setTempoFinal] = useState<number | null>(null);
  const relogio = useStopwatch(fb === null);
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  const corrigida = fb !== null;
  const valor: string | null =
    item.itemType === "B" ? (digitos.every(Boolean) ? digitos.join("") : null)
    : item.itemType === "D" ? (resposta?.trim() ? resposta.trim() : null)
    : resposta;

  async function enviar(emBranco = false) {
    if (enviando || corrigida) return;
    if (!emBranco && valor === null) return;
    setEnviando(true);
    setErro(null);
    try {
      const t = relogio.read();
      const f = await onSubmit({ answer: emBranco ? null : valor, confidence: confianca, timeSpentSec: t });
      setTempoFinal(t);
      if (emBranco) { setResposta(null); setDigitos(["", "", ""]); }
      setFb(f);
      setAba(f.explanation || (item.itemType === "D" && f.correctAnswer) ? "resolucao" : null);
    } catch {
      setErro("Não foi possível registrar a resposta. Confira sua conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  function escolher(v: string) { if (!corrigida) { setResposta((a) => (a === v ? null : v)); } }
  function riscar(letra: string) {
    if (corrigida) return;
    setRiscadas((r) => ({ ...r, [letra]: !r[letra] }));
    setResposta((a) => (a === letra ? null : a));
  }

  /* atalhos: C/E (tipo A), A–D (tipo C; Shift+letra risca), Enter responde */
  function aoTeclar(e: KeyboardEvent<HTMLElement>) {
    if (corrigida || e.altKey) return;
    const alvo = e.target as HTMLElement;
    const multilinha = alvo.tagName === "TEXTAREA";
    if (e.key === "Enter" && alvo.tagName !== "BUTTON" && (!multilinha || e.ctrlKey || e.metaKey)) { e.preventDefault(); void enviar(); return; }
    if (alvo.tagName === "INPUT" || multilinha || e.ctrlKey || e.metaKey) return;
    const k = e.key.toUpperCase();
    if (item.itemType === "A" && (k === "C" || k === "E")) { e.preventDefault(); escolher(k); }
    if (item.itemType === "C" && item.options?.some((o) => o.letter === k)) { e.preventDefault(); if (e.shiftKey) riscar(k); else escolher(k); }
  }

  function digitar(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1);
    setDigitos((a) => a.map((x, j) => (j === i ? d : x)));
    if (d && i < 2) campos.current[i + 1]?.focus();
  }
  function aoApagar(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[i] && i > 0) campos.current[i - 1]?.focus();
  }
  function aoColar(e: ClipboardEvent<HTMLInputElement>) {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 3);
    if (!t) return;
    e.preventDefault();
    setDigitos([t[0] ?? "", t[1] ?? "", t[2] ?? ""]);
    campos.current[Math.min(t.length, 3) - 1]?.focus();
  }

  /* estado visual de cada alternativa / botão de resposta */
  function estado(v: string): "livre" | "marcada" | "certa" | "errada" | "apagada" {
    if (!fb) return resposta === v ? "marcada" : "livre";
    if (fb.correctAnswer === v) return "certa";
    if (resposta === v) return fb.correctAnswer ? "errada" : "marcada";
    return "apagada";
  }
  const ESTILO = {
    livre: "border-linha bg-papel hover:border-mata/60 hover:bg-mata-tinta/50",
    marcada: "border-mata bg-mata-tinta ring-1 ring-mata",
    certa: "border-acerto bg-acerto-fundo text-acerto-texto",
    errada: "border-erro bg-erro-fundo text-erro",
    apagada: "border-linha bg-papel opacity-60",
  } as const;

  const marca: "ok" | "erro" | "branco" | null = !fb ? null : fb.isCorrect === true ? "ok" : fb.isCorrect === false ? "erro" : "branco";
  const longo = (item.contextText?.length ?? 0) > 520;
  const tom = fb?.isCorrect === true ? "border-acerto bg-acerto-fundo" : fb?.isCorrect === false ? "border-erro bg-erro-fundo" : "border-suave bg-mata-tinta/60";

  const titulo = !fb ? "" : fb.isCorrect === true ? "Você acertou." : fb.isCorrect === false ? "Você errou."
    : valor === null && item.itemType !== "D" ? "Deixado em branco." : "Resposta registrada.";
  const detalhe = !fb ? "" : fb.isCorrect === true ? `+${fb.delta} ponto${fb.delta === 1 ? "" : "s"}.`
    : fb.isCorrect === false ? (fb.delta < 0 ? `${fb.delta} ponto: no tipo A, cada erro anula um acerto.` : "Esse erro não desconta pontos.")
    : item.itemType === "D" ? "Compare com o espelho de resposta."
    : fb.correctAnswer ? "Sem pontos e sem desconto." : "Este item ainda não tem gabarito.";
  const calibragem = fb?.isCorrect === false && confianca === "certeza" ? "Você marcou “tenho certeza” e errou: vale revisar esse assunto."
    : fb?.isCorrect === true && confianca === "duvida" ? "Você acertou com dúvida: já está perto de dominar." : null;

  return (
    <article
      tabIndex={0}
      onKeyDown={aoTeclar}
      aria-label={`Item ${item.number}`}
      className="rounded-xl border border-linha bg-papel p-4 shadow-papel focus-visible:outline-azul md:p-6"
    >
      {/* ---- cabeçalho ---- */}
      <header className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-suave">{item.examLabel}</span>
        {item.language && <span className="text-sm text-suave">Língua {item.language}</span>}
        {item.subjects?.map((s) => <span key={s.slug} className="tag">{s.name}</span>)}
        {item.difficulty && <span className="rounded-md bg-duvida-fundo px-2 py-0.5 text-xs font-bold text-duvida-texto">{DIFICULDADE[item.difficulty]}</span>}
        <span className="ml-auto flex items-center gap-1">
          {onToggleSave && (
            <button type="button" onClick={() => onToggleSave(!saved)} aria-pressed={saved} aria-label={saved ? "Remover dos salvos" : "Salvar item"} title={saved ? "Remover dos salvos" : "Salvar item"}
              className="rounded-lg p-2 text-suave transition-colors hover:bg-mata-tinta hover:text-mata">
              {saved ? <BookmarkCheck className="h-5 w-5 text-mata" aria-hidden /> : <Bookmark className="h-5 w-5" aria-hidden />}
            </button>
          )}
          {onReport && (
            <button type="button" onClick={onReport} aria-label="Reportar problema neste item" title="Reportar problema"
              className="rounded-lg p-2 text-suave transition-colors hover:bg-erro-fundo hover:text-erro">
              <Flag className="h-5 w-5" aria-hidden />
            </button>
          )}
        </span>
      </header>

      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[4.5rem_1fr]">
        {/* ---- margem: número do item e marca de correção ---- */}
        <aside className="flex items-start gap-3 md:flex-col md:items-end md:border-r md:border-linha md:pr-5">
          <p className="text-4xl font-bold leading-none tabular-nums text-grafite">{item.number}</p>
          <p className="self-center text-xs text-suave md:self-end md:text-right">{TIPO[item.itemType]}</p>
          {marca && <div className="ml-auto md:ml-0 md:mt-2"><MarcaDeCorrecao tipo={marca} reduzido={reduzido} /></div>}
        </aside>

        <div className="min-w-0 space-y-5">
          {/* ---- texto-base ---- */}
          {(item.contextText || item.contextImages?.length) && (
            <section aria-label="Texto-base" className="border-l-[3px] border-ipe pl-4">
              {item.contextText && (
                <p className={cx("max-w-[68ch] whitespace-pre-line font-leitura text-[0.98rem] leading-[1.75] text-grafite/85", longo && !textoAberto && "line-clamp-6")}>
                  {item.contextText}
                </p>
              )}
              {longo && (
                <button type="button" onClick={() => setTextoAberto((v) => !v)} aria-expanded={textoAberto}
                  className="mt-2 text-sm font-bold text-azul underline decoration-azul/30 underline-offset-4 hover:decoration-azul">
                  {textoAberto ? "Mostrar menos" : "Ler o texto-base completo"}
                </button>
              )}
              {item.contextImages?.map((src) => (
                <img key={src} src={`/${src}`} alt={`Figura do texto-base do item ${item.number}`} loading="lazy" className="mt-3 max-w-full rounded-md border border-linha bg-white" />
              ))}
            </section>
          )}

          {/* ---- enunciado ---- */}
          <div>
            <p className="max-w-[68ch] whitespace-pre-line font-leitura text-[1.0625rem] leading-[1.75] text-grafite [text-wrap:pretty]">{item.text}</p>
            {item.images?.map((src) => (
              <img key={src} src={`/${src}`} alt={`Figura do item ${item.number}`} loading="lazy" className="mt-3 max-w-full rounded-md border border-linha bg-white" />
            ))}
            {!!item.works?.length && (
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {item.works.map((w) => (
                  <a key={w.id} href={`/obras/${w.id}`} className="inline-flex items-center gap-1.5 text-azul underline decoration-azul/30 underline-offset-4 hover:decoration-azul">
                    <BookOpen className="h-4 w-4" aria-hidden /> {w.title}
                  </a>
                ))}
              </p>
            )}
          </div>

          {/* ---- área de resposta ---- */}
          {item.itemType === "A" && (
            <div role="radiogroup" aria-label="Sua resposta" className="grid max-w-md grid-cols-2 gap-3">
              {([["C", "Certo"], ["E", "Errado"]] as const).map(([k, rotulo]) => (
                <button key={k} type="button" role="radio" aria-checked={resposta === k} disabled={corrigida} onClick={() => escolher(k)}
                  className={cx("flex min-h-14 items-center justify-between rounded-lg border px-4 text-base font-bold transition-colors active:translate-y-px disabled:cursor-default", ESTILO[estado(k)])}>
                  {rotulo}
                  <kbd className="hidden rounded border border-grafite/30 px-1.5 text-xs font-normal opacity-60 md:inline">{k}</kbd>
                </button>
              ))}
            </div>
          )}

          {item.itemType === "B" && (
            <fieldset disabled={corrigida}>
              <legend className="mb-2 text-sm text-suave">Resposta de 000 a 999</legend>
              <div className="flex gap-2">
                {digitos.map((d, i) => (
                  <input key={i} ref={(el) => { campos.current[i] = el; }} value={d} inputMode="numeric" autoComplete="off" aria-label={`Dígito ${i + 1} de 3`}
                    onChange={(e) => digitar(i, e.target.value)} onKeyDown={(e) => aoApagar(i, e)} onPaste={aoColar} onFocus={(e) => e.currentTarget.select()}
                    className={cx("h-14 w-12 rounded-lg border bg-papel text-center text-2xl font-bold tabular-nums transition-colors focus-visible:border-mata",
                      corrigida ? (fb?.isCorrect ? ESTILO.certa : fb?.isCorrect === false ? ESTILO.errada : ESTILO.apagada) : "border-linha")} />
                ))}
              </div>
              {corrigida && fb?.isCorrect === false && fb.correctAnswer && <p className="mt-2 text-sm text-suave">Resposta correta: <b className="tabular-nums text-grafite">{fb.correctAnswer}</b></p>}
            </fieldset>
          )}

          {item.itemType === "C" && (
            <ul role="radiogroup" aria-label="Alternativas" className="space-y-2">
              {item.options?.map((o) => {
                const e = estado(o.letter);
                const riscada = !!riscadas[o.letter] && !corrigida;
                return (
                  <li key={o.letter} className="group flex items-stretch gap-2">
                    <button type="button" role="radio" aria-checked={resposta === o.letter} disabled={corrigida} onClick={() => { setRiscadas((r) => ({ ...r, [o.letter]: false })); escolher(o.letter); }}
                      className={cx("flex min-w-0 flex-1 items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors active:translate-y-px disabled:cursor-default", ESTILO[e], riscada && "opacity-55")}>
                      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-bold", e === "livre" || e === "apagada" ? "border-linha text-suave" : "border-current")}>{o.letter}</span>
                      <span className={cx("font-leitura text-base leading-relaxed", riscada && "line-through decoration-grafite/70 decoration-2")}>{o.text}</span>
                    </button>
                    {!corrigida && (
                      <button type="button" onClick={() => riscar(o.letter)} aria-pressed={!!riscadas[o.letter]} aria-label={`${riscadas[o.letter] ? "Desfazer risco da" : "Riscar a"} alternativa ${o.letter}`} title="Riscar alternativa (Shift + letra)"
                        className="self-start rounded-lg p-2 text-suave transition-opacity hover:bg-mata-tinta hover:text-mata focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100">
                        <Scissors className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {item.itemType === "D" && (
            <div>
              <label htmlFor={`d-${item.id}`} className="mb-2 block text-sm text-suave">Escreva sua resposta e compare com o espelho depois</label>
              <textarea id={`d-${item.id}`} rows={7} value={resposta ?? ""} disabled={corrigida} onChange={(e) => setResposta(e.target.value)}
                className="w-full max-w-[68ch] rounded-lg border border-linha bg-papel p-3 font-leitura text-base leading-relaxed placeholder:text-suave/70 focus-visible:border-mata" />
              <p className="mt-1 text-xs text-suave tabular-nums">{(resposta ?? "").trim() ? (resposta ?? "").trim().split(/\s+/).length : 0} palavras</p>
            </div>
          )}

          {/* ---- confiança, tempo e envio ---- */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-linha pt-4">
            {!corrigida && item.itemType !== "D" && valor !== null && (
              <div role="radiogroup" aria-label="Quão seguro você está?" className="flex rounded-lg border border-linha p-0.5">
                {([["certeza", "Tenho certeza", ShieldCheck], ["duvida", "Dúvida", Scale]] as const).map(([k, rotulo, Icone]) => (
                  <button key={k} type="button" role="radio" aria-checked={confianca === k} onClick={() => setConfianca(k)}
                    className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition-colors", confianca === k ? (k === "certeza" ? "bg-mata-tinta text-mata" : "bg-duvida-fundo text-duvida-texto") : "text-suave hover:text-grafite")}>
                    <Icone className="h-4 w-4" aria-hidden /> {rotulo}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-suave" aria-label="Tempo neste item">
                <Timer className="h-4 w-4" aria-hidden /> {mmss(tempoFinal ?? relogio.sec)}
              </span>
              {!corrigida && item.itemType !== "D" && (
                <button type="button" onClick={() => enviar(true)} disabled={enviando}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-suave underline decoration-linha underline-offset-4 hover:text-grafite disabled:opacity-50">
                  Deixar em branco
                </button>
              )}
              {!corrigida && (
                <button type="button" onClick={() => enviar()} disabled={valor === null || enviando}
                  className="rounded-lg bg-mata px-5 py-2.5 text-sm font-bold text-papel transition-colors hover:bg-mata-escura active:translate-y-px disabled:cursor-not-allowed disabled:bg-linha disabled:text-suave">
                  {enviando ? "Registrando…" : item.itemType === "D" ? "Registrar resposta" : "Responder"}
                </button>
              )}
            </div>
          </div>
          {erro && <p role="alert" className="text-sm font-bold text-erro">{erro}</p>}

          {/* ---- feedback ---- */}
          <div role="status" aria-live="polite">
            {fb && (
              <div className={cx("rounded-md border-l-4 px-4 py-3", tom)}>
                <p className="font-bold">{titulo} <span className="font-normal">{detalhe}</span></p>
                {fb.correctAnswer && item.itemType !== "D" && <p className="mt-1 text-sm">Gabarito: <b>{nomeGabarito(item.itemType, fb.correctAnswer)}</b></p>}
                {calibragem && <p className="mt-1 text-sm">{calibragem}</p>}
                {typeof fb.percentCorrect === "number" && (
                  <div className="mt-2 max-w-xs">
                    <div className="h-1.5 overflow-hidden rounded-sm bg-linha"><div className="h-full bg-azul" style={{ width: `${fb.percentCorrect}%` }} /></div>
                    <p className="mt-1 text-xs text-suave tabular-nums">{Math.round(fb.percentCorrect)}% dos alunos acertaram este item</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---- resolução e comentários ---- */}
          <div>
            <div role="tablist" aria-label="Resolução e comentários" className="flex gap-1 border-b border-linha">
              <button type="button" role="tab" id={`r-${item.id}`} aria-selected={aba === "resolucao"} aria-controls={`pr-${item.id}`} disabled={!corrigida}
                onClick={() => setAba((a) => (a === "resolucao" ? null : "resolucao"))} title={corrigida ? undefined : "Disponível depois de responder"}
                className={cx("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:text-suave/70", aba === "resolucao" ? "border-mata text-mata" : "border-transparent text-suave hover:text-grafite")}>
                {corrigida ? <Lightbulb className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />} Resolução comentada
              </button>
              <button type="button" role="tab" id={`c-${item.id}`} aria-selected={aba === "comentarios"} aria-controls={`pc-${item.id}`}
                onClick={() => setAba((a) => (a === "comentarios" ? null : "comentarios"))}
                className={cx("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-bold transition-colors", aba === "comentarios" ? "border-mata text-mata" : "border-transparent text-suave hover:text-grafite")}>
                <MessageSquare className="h-4 w-4" aria-hidden /> Comentários{commentsCount ? ` (${commentsCount})` : ""}
              </button>
            </div>
            <Painel aberto={aba === "resolucao"}>
              <div role="tabpanel" id={`pr-${item.id}`} aria-labelledby={`r-${item.id}`} className="space-y-3 pt-4">
                {item.itemType === "D" && fb?.correctAnswer && (
                  <div className="rounded-md border border-linha bg-mata-tinta/50 p-4">
                    <p className="mb-1 text-sm font-bold">Espelho de resposta</p>
                    <p className="max-w-[68ch] whitespace-pre-line font-leitura leading-[1.75]">{fb.correctAnswer}</p>
                  </div>
                )}
                {fb?.explanation
                  ? <p className="max-w-[68ch] whitespace-pre-line font-leitura leading-[1.75]">{fb.explanation}</p>
                  : <p className="text-sm text-suave">Este item ainda não tem resolução comentada.</p>}
              </div>
            </Painel>
            <Painel aberto={aba === "comentarios"}>
              <div role="tabpanel" id={`pc-${item.id}`} aria-labelledby={`c-${item.id}`} className="pt-4">
                {comments ?? <p className="text-sm text-suave">Ainda não há comentários neste item. Comece a conversa.</p>}
              </div>
            </Painel>
          </div>
        </div>
      </div>
    </article>
  );
}
