import Link from "next/link";
import { getSession } from "@/lib/auth";
import { sair } from "@/actions/auth";

export default async function Nav() {
  const s = await getSession();
  const L = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="px-2 py-1 text-sm hover:underline">{children}</Link>;
  return (
    <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2">
        <Link href="/" className="mr-3 font-bold">PAS·Questões</Link>
        <L href="/questoes">Questões</L><L href="/obras">Obras</L>
        {s && <><L href="/simulados">Simulados</L><L href="/listas">Listas</L><L href="/desempenho">Desempenho</L><L href="/cursos">Cursos</L></>}
        {s?.role === "admin" && <L href="/admin">Admin</L>}
        <span className="ml-auto" />
        {s ? <form action={sair} className="flex items-center gap-2 text-sm"><span className="text-stone-500">{s.name}</span><button className="btn">Sair</button></form>
           : <><L href="/entrar">Entrar</L><Link href="/cadastrar" className="btn btn-primary">Criar conta</Link></>}
      </nav>
    </header>
  );
}
