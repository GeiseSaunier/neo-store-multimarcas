import { STORE, PIX } from '@/lib/config';

export const metadata = { title: 'Formas de pagamento · Neo Store Multimarcas' };

export default function Pagamentos() {
  const pct = Math.round(STORE.pixDiscount * 100);
  const hours = STORE.pixMinutes / 60;
  const validity = Number.isInteger(hours) ? `${hours} ${hours === 1 ? 'hora' : 'horas'}` : `${STORE.pixMinutes} minutos`;
  return (
    <>
      <h1>Formas de pagamento</h1>
      <p>
        {PIX.direct ? 'O PIX é pago direto na conta da loja. Cartão e boleto' : 'Todos os pagamentos'} são processados pelo <b>Mercado Pago</b>.
        Os dados do seu cartão são digitados no ambiente seguro do Mercado Pago e não passam pelo nosso site.
      </p>

      <h2>PIX · {pct}% de desconto</h2>
      {PIX.direct ? (
        <>
          <p>Ao finalizar a compra, geramos um QR Code e um código copia e cola com o valor exato do pedido, válidos por {validity}. O pagamento vai direto para a conta da loja:</p>
          <p><b>{PIX.name}</b> · {PIX.bank}<br />Chave PIX ({PIX.keyType}): <b>{PIX.keyLabel}</b></p>
          <p>Depois de pagar, envie o comprovante pelo WhatsApp {STORE.whatsappLabel}. Confirmamos assim que o pagamento aparecer na nossa conta, e você recebe um e-mail. O desconto de {pct}% vale sobre o total com frete.</p>
        </>
      ) : (
        <p>Ao finalizar a compra, geramos um QR Code e um código copia e cola válidos por {validity}. A confirmação é automática, em poucos segundos, e você recebe um e-mail assim que o pagamento é aprovado. O desconto de {pct}% vale sobre o total com frete.</p>
      )}

      <h2>Cartão de crédito · até {STORE.maxInstallments}x sem juros</h2>
      <p>Visa, Mastercard, Elo, American Express e outras bandeiras aceitas pelo Mercado Pago. A aprovação costuma ser imediata; em alguns casos o Mercado Pago faz uma análise de segurança que pode levar algumas horas.</p>

      <h2>Boleto</h2>
      <p>O boleto é gerado no Mercado Pago e compensa em até 2 dias úteis após o pagamento. As peças ficam reservadas para você por até 5 dias enquanto aguardamos a compensação.</p>

      <h2>Reserva das peças</h2>
      <p>As peças da sua sacola ficam reservadas a partir do momento em que o pedido é criado. Se o pagamento não for concluído no prazo, o pedido é cancelado automaticamente e as peças voltam para a vitrine.</p>
    </>
  );
}
