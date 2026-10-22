import { supabaseAdmin } from '@/lib/supabase-server';
import { notifyStatus } from '@/lib/email';
import { json, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Chamado pelo painel quando um pedido muda para "Enviado" ou "Entregue": avisa a cliente por e-mail.
export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!token) return fail('Sem permissão.', 401);
  const db = supabaseAdmin();
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return fail('Sem permissão.', 401);
  const { data: adm } = await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
  if (!adm) return fail('Sem permissão.', 403);
  const { orderId } = await req.json();
  const { data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return fail('Pedido não encontrado.', 404);
  await notifyStatus(order);
  return json({ ok: true });
}
