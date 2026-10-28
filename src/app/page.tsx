import Link from "next/link";
export default function Home() {
  return (
    <div className="space-y-6 py-8">
      <h1 className="text-3xl font-bold">Treine para o PAS/UnB com questões reais</h1>
      <p className="max-w-2xl text-stone-600 dark:text-stone-400">Filtre por etapa, disciplina, tipo de item e obra obrigatória; monte listas; faça simulados no modelo Cebraspe e veja seu escore e os cursos ao seu alcance.</p>
      <div className="flex gap-2"><Link href="/questoes" className="btn btn-primary">Ver questões</Link><Link href="/cadastrar" className="btn">Criar conta</Link></div>
    </div>
  );
}
