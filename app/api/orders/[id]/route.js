import { supabaseAdmin } from '@/lib/supabase-server';
import { json, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Status público de um pedido (o id é um código longo e impossível de adivinhar).
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail('Pedido não encontrado.', 404);
  const { data } = await supabaseAdmin().from('orders')
    .select('id,code,status,total,payment_method,pix_qr,pix_qr_base64,pix_expires_at,shipping_label,customer_name,email,tracking_code')
    .eq('id', id).maybeSingle();
  if (!data) return fail('Pedido não encontrado.', 404);
  const { customer_name, ...rest } = data;
  return json({ ...rest, first_name: customer_name.split(' ')[0], total: Number(data.total) });
}
