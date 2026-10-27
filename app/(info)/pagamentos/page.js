import { STORE } from '@/lib/config';

export const metadata = { title: 'Formas de pagamento · Neo Store Multimarcas' };

export default function Pagamentos() {
  const pct = Math.round(STORE.pixDiscount * 100);
  return (
    <>
      <h1>Formas de pagamento</h1>
      <p>Todos os pagamentos são processados pelo <b>Mercado Pago</b>. Os dados do seu cartão são digitados no ambiente seguro do Mercado Pago e não passam pelo nosso site.</p>

      <h2>PIX · {pct}% de desconto</h2>
      <p>Ao finalizar a compra, geramos um QR Code e um código copia e cola válidos por {STORE.pixMinutes} minutos. A confirmação é automática, em poucos segundos, e você recebe um e-mail assim que o pagamento é aprovado. O desconto de {pct}% vale sobre o total com frete.</p>

      <h2>Cartão de crédito · até {STORE.maxInstallments}x sem juros</h2>
      <p>Visa, Mastercard, Elo, American Express e outras bandeiras aceitas pelo Mercado Pago. A aprovação costuma ser imediata; em alguns casos o Mercado Pago faz uma análise de segurança que pode levar algumas horas.</p>

      <h2>Boleto</h2>
      <p>O boleto é gerado no Mercado Pago e compensa em até 2 dias úteis após o pagamento. As peças ficam reservadas para você por até 5 dias enquanto aguardamos a compensação.</p>

      <h2>Reserva das peças</h2>
      <p>As peças da sua sacola ficam reservadas a partir do momento em que o pedido é criado. Se o pagamento não for concluído no prazo, o pedido é cancelado automaticamente e as peças voltam para a vitrine.</p>
    </>
  );
}
