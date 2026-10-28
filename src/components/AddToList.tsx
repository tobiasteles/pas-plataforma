"use client";
import { useState, useTransition } from "react";
import { adicionarNaLista } from "@/actions/lists";

export default function AddToList({ questionId, lists }: { questionId: string; lists: { id: number; name: string }[] }) {
  const [sel, setSel] = useState(lists[0]?.id ?? 0);
  const [done, setDone] = useState(false);
  const [p, go] = useTransition();
  if (!lists.length) return <a className="text-xs text-blue-600 underline" href="/listas">crie uma lista</a>;
  return (
    <span className="flex items-center gap-1">
      <select className="input w-auto py-1" value={sel} onChange={(e) => { setSel(+e.target.value); setDone(false); }}>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <button className="btn" disabled={p} onClick={() => go(async () => { await adicionarNaLista(sel, questionId); setDone(true); })}>{done ? "✓ adicionada" : "+ lista"}</button>
    </span>
  );
}
