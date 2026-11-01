"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { sair } from "@/actions/auth";

type Usuario = { name: string; role: "student" | "admin" } | null;
const PUBLICOS = [{ href: "/questoes", rotulo: "Questões" }, { href: "/obras", rotulo: "Obras" }];
const PRIVADOS = [{ href: "/simulados", rotulo: "Simulados" }, { href: "/listas", rotulo: "Listas" }, { href: "/desempenho", rotulo: "Desempenho" }, { href: "/cursos", rotulo: "Cursos" }];

const cx = (...c: (string | false)[]) => c.filter(Boolean).join(" ");
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

function Marca() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Triênio, página inicial">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#14604A" />
        <rect x="6.5" y="17" width="5" height="8" rx="1" fill="#fff" /><rect x="13.5" y="12" width="5" height="13" rx="1" fill="#fff" /><rect x="20.5" y="6" width="5" height="19" rx="1" fill="#fff" />
        <circle cx="23" cy="3.6" r="2.1" fill="#E8B923" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-grafite">triênio</span>
    </Link>
  );
}

export default function NavBar({ usuario }: { usuario: Usuario }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  useEffect(() => setAberto(false), [caminho]);

  const links = usuario ? [...PUBLICOS, ...PRIVADOS] : PUBLICOS;
  const ativo = (href: string) => caminho === href || caminho.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-40 border-b border-linha bg-papel">
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
        <Marca />

        <ul className="hidden items-stretch gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href} className="flex">
              <Link href={l.href} aria-current={ativo(l.href) ? "page" : undefined}
                className={cx("relative flex items-center px-3 text-[0.95rem] transition-colors hover:text-grafite", ativo(l.href) ? "font-bold text-grafite" : "text-suave",
                  "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-mata after:transition-transform after:duration-200 motion-reduce:after:transition-none",
                  ativo(l.href) ? "after:scale-x-100" : "after:scale-x-0")}>
                {l.rotulo}
              </Link>
            </li>))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {usuario ? (
            <>
              {usuario.role === "admin" && (
                <Link href="/admin" className={cx("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors hover:bg-mata-tinta", ativo("/admin") ? "bg-mata-tinta text-mata" : "text-suave hover:text-mata")}>
                  <ShieldCheck className="h-4 w-4" aria-hidden /> Admin
                </Link>)}
              <span className="flex items-center gap-2 pl-2" title={usuario.name}>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-mata-tinta text-sm font-bold text-mata" aria-hidden>{iniciais(usuario.name)}</span>
                <span className="max-w-[9rem] truncate text-sm text-grafite">{usuario.name.split(" ")[0]}</span>
              </span>
              <form action={sair}>
                <button className="rounded-lg p-2 text-suave transition-colors hover:bg-mata-tinta hover:text-mata" aria-label="Sair" title="Sair"><LogOut className="h-5 w-5" aria-hidden /></button>
              </form>
            </>
          ) : (
            <>
              <Link href="/entrar" className="rounded-lg px-3 py-1.5 text-sm font-bold text-grafite transition-colors hover:bg-mata-tinta">Entrar</Link>
              <Link href="/cadastrar" className="btn btn-primary">Criar conta</Link>
            </>
          )}
        </div>

        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-controls="menu-movel"
          className="ml-auto rounded-lg p-2 text-grafite hover:bg-mata-tinta md:hidden" aria-label={aberto ? "Fechar menu" : "Abrir menu"}>
          {aberto ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
        </button>
      </nav>

      <div id="menu-movel" hidden={!aberto} className="border-t border-linha bg-papel md:hidden">
        <ul className="mx-auto max-w-5xl px-2 py-2">
          {[...links, ...(usuario?.role === "admin" ? [{ href: "/admin", rotulo: "Admin" }] : [])].map((l) => (
            <li key={l.href}><Link href={l.href} className={cx("block rounded-lg px-3 py-3 text-base", ativo(l.href) ? "bg-mata-tinta font-bold text-mata" : "text-grafite")}>{l.rotulo}</Link></li>))}
        </ul>
        <div className="mx-auto flex max-w-5xl items-center gap-3 border-t border-linha px-4 py-3">
          {usuario ? (
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-mata-tinta text-sm font-bold text-mata" aria-hidden>{iniciais(usuario.name)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{usuario.name}</span>
              <form action={sair}><button className="btn">Sair</button></form>
            </>
          ) : (
            <><Link href="/entrar" className="btn flex-1">Entrar</Link><Link href="/cadastrar" className="btn btn-primary flex-1">Criar conta</Link></>
          )}
        </div>
      </div>
    </header>
  );
}
