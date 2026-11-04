/** Aparece enquanto uma página do servidor carrega, para ninguém achar que travou. */
export default function Carregando() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 py-6">
      <span className="sr-only">Carregando…</span>
      <div className="h-8 w-56 animate-pulse rounded-md bg-linha motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-linha/60 motion-reduce:animate-none" />)}
    </div>
  );
}
