import Link from "next/link";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Conta criada", robots: { index: false, follow: false } };

export default async function BemVindo() {
  const { name } = await requireUser();
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-3xl font-bold">Conta criada, {name.split(" ")[0]}. Obrigado por se cadastrar.</h1>
      <p className="mt-3 text-suave">Já dá para começar. Estes são os caminhos mais comuns:</p>
      <ul className="mt-6 divide-y divide-linha border-y border-linha">
        <li className="py-4"><Link href="/questoes" className="font-bold text-mata underline underline-offset-4">Resolver questões</Link><p className="mt-1 text-sm text-suave">Filtre por etapa, matéria ou obra e confira o gabarito logo depois de responder.</p></li>
        <li className="py-4"><Link href="/simulados" className="font-bold text-mata underline underline-offset-4">Fazer um simulado</Link><p className="mt-1 text-sm text-suave">Monte uma prova no modelo do Cebraspe e veja seu escore ao final.</p></li>
        <li className="py-4"><Link href="/listas" className="font-bold text-mata underline underline-offset-4">Criar uma lista de exercícios</Link><p className="mt-1 text-sm text-suave">Guarde as questões que você quer revisar.</p></li>
      </ul>
    </div>
  );
}
