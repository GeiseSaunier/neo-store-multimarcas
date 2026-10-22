import { supabaseAdmin } from '@/lib/supabase-server';
import { getPayment, validSignature } from '@/lib/mercadopago';
import { notifyPaid } from '@/lib/email';
import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';

// O Mercado Pago chama esta rota sempre que um pagamento muda de situação.
export async function POST(req) {
  const url = new URL(req.url);
  let body = {};
  try { body = await req.json(); } catch {}
  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const id = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');
  if (type !== 'payment' || !id) return json({ ignored: true });
  if (!validSignature(req, url.searchParams.get('data.id') || id)) return json({ error: 'assinatura inválida' }, 401);

  try {
    const pay = await getPayment(id);
    const orderId = pay.external_reference;
    if (!orderId) return json({ ignored: true });
    const db = supabaseAdmin();
    const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (!order) return json({ ignored: true });

    const upd = { mp_payment_id: String(pay.id), mp_status: pay.status };
    let becamePaid = false;
    if (pay.status === 'approved' && ['pending', 'cancelled'].includes(order.status)) {
      Object.assign(upd, { status: 'paid', paid_at: new Date().toISOString(), seen: false });
      becamePaid = true;
    } else if (['refunded', 'charged_back'].includes(pay.status)) {
      upd.status = 'refunded';
    } else if (pay.status === 'cancelled' && order.status === 'pending') {
      upd.status = 'cancelled';
    }
    await db.from('orders').update(upd).eq('id', orderId);

    if (becamePaid) {
      await db.rpc('decrement_stock', { p_order: orderId });
      const { data: items } = await db.from('order_items').select('*').eq('order_id', orderId);
      await notifyPaid({ ...order, ...upd }, items || []);
    }
    return json({ ok: true });
  } catch (e) {
    console.error('webhook', e);
    // 500 faz o Mercado Pago tentar de novo mais tarde.
    return json({ error: 'erro ao processar' }, 500);
  }
}

export const GET = POST;
