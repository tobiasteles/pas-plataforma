import Link from "next/link";

export const metadata = { title: "Página não encontrada", robots: { index: false } };

export default function NaoEncontrada() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="text-6xl font-bold tabular-nums text-mata">404</p>
      <h1 className="mt-4 text-3xl font-bold">Não achamos essa página</h1>
      <p className="mt-3 text-suave">O endereço pode ter mudado ou estar digitado errado. Você pode voltar ao início ou procurar uma questão.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">Ir para o início</Link>
        <Link href="/questoes" className="btn">Ver questões</Link>
      </div>
    </div>
  );
}
