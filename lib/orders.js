import 'server-only';

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const NOTE = 'Cancelado automaticamente: o pagamento não foi concluído no prazo.';

// Cancela pedidos que ficaram esperando pagamento, devolvendo as peças ao estoque
// (o banco faz a devolução ao mudar o status). Se o pagamento chegar depois,
// o webhook do Mercado Pago marca o pedido como pago mesmo assim.
export async function expireStaleOrders(db) {
  // PIX: 10 minutos de tolerância depois do vencimento do QR Code.
  const pix = await db.from('orders').update({ status: 'cancelled', notes: NOTE })
    .eq('status', 'pending').eq('payment_method', 'pix').lt('pix_expires_at', ago(10 * 60e3)).select('id');
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

// Traduz o erro 'ESTOQUE|nome|tamanho|disponível' do banco em uma mensagem para a cliente.
export function stockMessage(error) {
  const m = /ESTOQUE\|([^|]*)\|([^|]*)\|(\d+)/.exec(error?.message || '');
  if (!m) return null;
  const [, name, size, avail] = m;
  const what = size && size !== 'Único' ? `${name} no tamanho ${size}` : name;
  return Number(avail) > 0 ? `Temos só ${avail} unidade(s) de ${what}.` : `${what} acabou de esgotar. Atualize a página.`;
}
