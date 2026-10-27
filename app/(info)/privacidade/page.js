import { LEGAL, STORE } from '@/lib/config';

export const metadata = { title: 'Política de privacidade · Neo Store Multimarcas' };

// Texto-base de acordo com a LGPD (Lei 13.709/2018). Revise com a loja (e, se possível, com um advogado).
export default function Privacidade() {
  return (
    <>
      <h1>Política de privacidade</h1>
      <p className="upd">Última atualização: [DATA]</p>
      <p>Esta política explica quais dados pessoais a {LEGAL.company} (“Neo Store”) coleta na loja virtual, para que usa e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

      <h2>Dados que coletamos</h2>
      <ul>
        <li><b>Na compra:</b> nome completo, e-mail, celular, CPF e endereço de entrega, além das peças compradas e da forma de pagamento.</li>
        <li><b>No cadastro de novidades:</b> o e-mail ou o número de WhatsApp que você informar.</li>
        <li><b>No seu navegador:</b> a sacola, os favoritos e o tema escolhido ficam guardados no próprio aparelho (armazenamento local), não em nossos servidores.</li>
      </ul>
      <p>Não recebemos nem guardamos os dados do seu cartão: eles são digitados diretamente no Mercado Pago.</p>

      <h2>Para que usamos</h2>
      <ul>
        <li>Processar o pagamento, emitir nota fiscal, separar e entregar o pedido (execução do contrato e obrigação legal).</li>
        <li>Enviar e-mails e mensagens sobre o andamento do pedido.</li>
        <li>Enviar novidades e promoções, somente se você se cadastrou para isso (consentimento). Você pode sair a qualquer momento.</li>
        <li>Prevenir fraudes e cumprir obrigações legais e fiscais.</li>
      </ul>

      <h2>Com quem compartilhamos</h2>
      <p>Somente com os serviços necessários para a loja funcionar:</p>
      <ul>
        <li><b>Mercado Pago:</b> processamento dos pagamentos.</li>
        <li><b>Correios / Melhor Envio</b> e transportadoras regionais: cálculo do frete e entrega.</li>
        <li><b>Supabase</b> (banco de dados), <b>Vercel</b> (hospedagem) e <b>Resend</b> (envio de e-mails): infraestrutura do site.</li>
      </ul>
      <p>Não vendemos seus dados.</p>

      <h2>Por quanto tempo guardamos</h2>
      <p>Os dados dos pedidos são guardados pelo prazo exigido pela legislação fiscal e de defesa do consumidor (em geral, 5 anos). Os contatos do cadastro de novidades ficam guardados até você pedir para sair.</p>

      <h2>Seus direitos</h2>
      <p>Você pode, a qualquer momento, pedir para confirmar se tratamos seus dados, acessar, corrigir, excluir ou levar seus dados para outro fornecedor, e retirar o consentimento para receber novidades (art. 18 da LGPD). Fale com a gente pelo e-mail <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> ou pelo WhatsApp {STORE.whatsappLabel}.</p>

      <h2>Segurança</h2>
      <p>O site usa conexão criptografada (HTTPS) e o acesso aos pedidos é restrito à equipe da loja.</p>
    </>
  );
}
