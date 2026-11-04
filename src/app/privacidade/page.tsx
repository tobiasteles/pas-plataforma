import Link from "next/link";
import Documento from "@/components/Documento";
import { CONTATO, GA_ID, SITE_NOME } from "@/lib/site";

export const metadata = { title: "Política de Privacidade", description: `Como o ${SITE_NOME} trata seus dados pessoais, em linguagem simples e conforme a LGPD.` };

// MODELO baseado no que o site realmente faz. Revise com um profissional de direito antes de publicar.
export default function Privacidade() {
  const contato = CONTATO.email ? <a className="text-azul underline underline-offset-4" href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a> : <Link className="text-azul underline underline-offset-4" href="/contato">página de contato</Link>;
  return (
    <Documento titulo="Política de Privacidade" secoes={[
      { titulo: "Quem é o responsável", texto: <p>O {SITE_NOME} é operado por {CONTATO.responsavel || "seu responsável (veja a página de contato)"}{CONTATO.cidade ? `, ${CONTATO.cidade}` : ""}. Para qualquer assunto sobre seus dados, escreva para {contato}.</p> },
      { titulo: "Quais dados coletamos", texto: <>
        <p><b>Cadastro:</b> nome, e-mail e senha. A senha é guardada de forma criptografada (hash); nós não conseguimos lê-la.</p>
        <p><b>Uso da plataforma:</b> as respostas que você marca, o tempo gasto, o nível de segurança que você informa (“tenho certeza” ou “dúvida”), suas listas, seus simulados e os resultados deles.</p>
        <p><b>Técnicos:</b> um cookie de sessão que mantém você logado.</p></> },
      { titulo: "Para que usamos", texto: <>
        <p>Para criar e manter sua conta, corrigir suas respostas, calcular escores, mostrar seu desempenho e manter o site seguro. Esses usos são necessários para prestar o serviço que você pediu.</p>
        {GA_ID && <p>Com o seu consentimento, também medimos o uso do site com o Google Analytics, para melhorar as páginas.</p>}</> },
      { id: "cookies", titulo: "Cookies", texto: <>
        <p><b>Essencial:</b> o cookie de sessão. Sem ele não há login, por isso ele não depende de consentimento.</p>
        {GA_ID ? <p><b>Análise (opcional):</b> o Google Analytics só é carregado se você clicar em “Aceitar” no aviso de cookies. Você pode mudar de ideia a qualquer momento em “Preferências de cookies”, no rodapé.</p> : <p>Este site não usa cookies de publicidade nem de análise.</p>}</> },
      { titulo: "Com quem compartilhamos", texto: <p>Não vendemos seus dados. Eles ficam em provedores de hospedagem e de banco de dados que operam o site (como o Neon, que guarda o banco de dados){GA_ID ? " e, se você aceitar, no Google Analytics" : ""}. Também podemos compartilhar dados quando a lei exigir.</p> },
      { titulo: "Por quanto tempo guardamos", texto: <p>Enquanto sua conta existir. Ao pedir a exclusão da conta, apagamos seus dados pessoais e suas respostas, salvo o que a lei obrigue a manter.</p> },
      { titulo: "Seus direitos (LGPD)", texto: <p>Você pode pedir confirmação de que tratamos seus dados, acesso, correção, anonimização, portabilidade, eliminação, informações sobre compartilhamento e a revogação de consentimento. Para isso, escreva para {contato}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p> },
      { titulo: "Menores de 18 anos", texto: <p>Muitos estudantes do PAS são menores de idade. Se você tem menos de 18 anos, peça a um responsável para ler esta política e os Termos de Uso antes de criar a conta. Tratamos os dados de adolescentes apenas para prestar o serviço e sempre no melhor interesse deles.</p> },
      { titulo: "Segurança", texto: <p>Usamos conexão segura (HTTPS), senhas com hash e acesso restrito à administração. Nenhum sistema é 100% imune; se houver um incidente que afete você, avisaremos como a lei determina.</p> },
      { titulo: "Mudanças nesta política", texto: <p>Quando mudarmos algo importante, atualizaremos a data no topo desta página.</p> },
    ]} />
  );
}
