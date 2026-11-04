import Link from "next/link";
import Documento from "@/components/Documento";
import { CONTATO, SITE_NOME } from "@/lib/site";

export const metadata = { title: "Termos de Uso", description: `Regras de uso do ${SITE_NOME}: conta, conteúdo, responsabilidades e limites.` };

// MODELO. Revise com um profissional de direito antes de publicar.
export default function Termos() {
  return (
    <Documento titulo="Termos de Uso" secoes={[
      { titulo: "Aceite", texto: <p>Ao criar uma conta ou usar o {SITE_NOME}, você concorda com estes termos e com a <Link href="/privacidade" className="text-azul underline underline-offset-4">Política de Privacidade</Link>.</p> },
      { titulo: "O que é o serviço", texto: <p>O {SITE_NOME} é uma plataforma de estudos com questões de provas anteriores do PAS e da UnB, simulados, listas e estatísticas de desempenho. É um projeto <b>independente</b>: não tem vínculo, parceria ou aprovação da Universidade de Brasília nem do Cebraspe.</p> },
      { titulo: "Sua conta", texto: <p>Você é responsável pelas informações do cadastro e por manter a senha em segredo. Não compartilhe sua conta. Se achar que alguém a usou sem permissão, avise pela página de <Link href="/contato" className="text-azul underline underline-offset-4">contato</Link>.</p> },
      { titulo: "Uso permitido", texto: <p>Use o site para estudar. Não é permitido: tentar acessar áreas ou dados de outras pessoas, sobrecarregar ou atacar o sistema, copiar o banco de questões em massa por meios automáticos, nem revender o conteúdo.</p> },
      { titulo: "Conteúdo", texto: <p>As questões vêm de provas aplicadas anteriormente e pertencem aos seus titulares. Gabaritos, resoluções, comentários e a organização do banco são produzidos ou tratados por nós. Se você é titular de algum conteúdo e quer pedir correção ou retirada, escreva para o nosso contato.</p> },
      { titulo: "Escores e estimativas", texto: <p>O escore mostrado é <b>bruto e de treino</b>. A nota oficial do PAS passa por padronização entre candidatos, e as comparações com notas de corte são estimativas. Não há garantia de aprovação. Gabaritos e resoluções podem conter erros: se encontrar algum, nos avise.</p> },
      { titulo: "Disponibilidade", texto: <p>Fazemos o possível para manter o site no ar, mas ele pode ficar indisponível para manutenção ou por falhas fora do nosso controle.</p> },
      { titulo: "Encerramento", texto: <p>Você pode pedir a exclusão da sua conta a qualquer momento. Podemos suspender contas que violem estes termos.</p> },
      { titulo: "Limite de responsabilidade", texto: <p>Na medida permitida pela lei, não respondemos por prejuízos decorrentes do uso ou da impossibilidade de usar o site, nem por decisões de estudo tomadas com base nele. Isso não afasta direitos que o Código de Defesa do Consumidor garanta a você.</p> },
      { titulo: "Mudanças e contato", texto: <p>Podemos atualizar estes termos; a data no topo mostra a última versão. Dúvidas: {CONTATO.email ? <a href={`mailto:${CONTATO.email}`} className="text-azul underline underline-offset-4">{CONTATO.email}</a> : <Link href="/contato" className="text-azul underline underline-offset-4">página de contato</Link>}.</p> },
    ]} />
  );
}
