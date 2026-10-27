import 'server-only';
import { PIX } from './config.js';

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const NOTE = 'Cancelado automaticamente: o pagamento não foi concluído no prazo.';

// Cancela pedidos que ficaram esperando pagamento, devolvendo as peças ao estoque
// (o banco faz a devolução ao mudar o status). Se o pagamento chegar depois,
// o webhook do Mercado Pago (ou o "Marcar como pago" do painel, no PIX direto)
// marca o pedido como pago mesmo assim.
export async function expireStaleOrders(db) {
  // PIX pelo Mercado Pago: 10 minutos de tolerância depois do vencimento do QR Code.
  // PIX direto: a confirmação é manual, então espera mais (PIX.graceMinutes).
  const pixMp = await db.from('orders').update({ status: 'cancelled', notes: NOTE })
    .eq('status', 'pending').eq('payment_method', 'pix').eq('pix_direct', false).lt('pix_expires_at', ago(10 * 60e3)).select('id');
  const pixDirect = await db.from('orders').update({ status: 'cancelled', notes: NOTE })
    .eq('status', 'pending').eq('payment_method', 'pix').eq('pix_direct', true).lt('pix_expires_at', ago(PIX.graceMinutes * 60e3)).select('id');
  const pix = { data: [...(pixMp.data || []), ...(pixDirect.data || [])], error: pixMp.error || pixDirect.error };
  // Cartão (48 h) e boleto (5 dias) sem pagamento em análise ou boleto emitido.
  // (boleto emitido fica "pending" no Mercado Pago, que avisa quando ele vence)
  const open = 'or(mp_status.is.null,mp_status.not.in.(in_process,pending,authorized))';
  const other = await db.from('orders').update({ status: 'cancelled', notes: NOTE })
    .eq('status', 'pending')
    .or(`and(payment_method.eq.card,created_at.lt."${ago(48 * 3600e3)}",${open}),and(payment_method.eq.boleto,created_at.lt."${ago(5 * 86400e3)}",${open})`)
    .select('id');
  if (pix.error || other.error) console.error('expirar pedidos', pix.error || other.error);
  return (pix.data?.length || 0) + (other.data?.length || 0);
}

// Mensagem para a cliente quando falta estoque ("acabou de esgotar" serve para qualquer peça,
// sem depender de gênero: bolsa, tênis, vestido).
export function stockText(name, size, avail) {
  const what = size && size !== 'Único' ? `${name} no tamanho ${size}` : name;
  const n = Number(avail);
  if (n <= 0) return `${what} acabou de esgotar. Atualize a página.`;
  return `Temos só ${n} ${n === 1 ? 'unidade' : 'unidades'} de ${what}.`;
}

// Traduz o erro 'ESTOQUE|nome|tamanho|disponível' do banco em uma mensagem para a cliente.
export function stockMessage(error) {
  const m = /ESTOQUE\|([^|]*)\|([^|]*)\|(\d+)/.exec(error?.message || '');
  return m ? stockText(m[1], m[2], m[3]) : null;
}
