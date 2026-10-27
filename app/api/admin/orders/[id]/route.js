import { supabaseAdmin } from '@/lib/supabase-server';
import { denyUnlessAdmin } from '@/lib/admin';
import { notifyPaid, notifyStatus } from '@/lib/email';
import { stockMessage } from '@/lib/orders';
import { json, fail } from '@/lib/api';
import { NEXT_STATUS } from '@/lib/config';
export const dynamic = 'force-dynamic';

// Chamado pelo painel para salvar rastreio e anotações e mudar o status de um pedido.
// O estoque é ajustado pelo banco; aqui ficam os e-mails para a cliente.
export async function POST(req, { params }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const denied = await denyUnlessAdmin(req, db);
  if (denied) return denied;

  const { status, tracking_code, notes } = await req.json().catch(() => ({}));
  const { data: order } = await db.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) return fail('Pedido não encontrado.', 404);

  const upd = { tracking_code: String(tracking_code || '').trim() || null, notes: String(notes || '').trim() || null };
  if (status) {
    if (!NEXT_STATUS[order.status]?.includes(status)) return fail('Esta mudança de status não é permitida.');
    upd.status = status;
    if (status === 'paid' && !order.paid_at) upd.paid_at = new Date().toISOString();
  }
  const { data: saved, error } = await db.from('orders').update(upd).eq('id', id).select().single();
  if (error) {
    if (stockMessage(error)) return fail('Não há estoque suficiente para reabrir este pedido. Ajuste o estoque da peça e tente de novo.', 409);
    console.error(error);
    return fail('Não foi possível atualizar o pedido.', 500);
  }

  if (status === 'paid') {
    const { data: items } = await db.from('order_items').select('*').eq('order_id', id);
    await notifyPaid(saved, items || []);
  }
  if (status === 'shipped' || status === 'delivered') await notifyStatus(saved);
  return json({ order: saved });
}
