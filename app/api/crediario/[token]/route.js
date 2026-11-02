import { supabaseAdmin } from '@/lib/supabase-server';
import { json, fail } from '@/lib/api';
import { publicStatement } from '@/lib/crediario';
export const dynamic = 'force-dynamic';

// Extrato público de uma venda a prazo (o código do link é longo e impossível de adivinhar).
export async function GET(_req, { params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return fail('Extrato não encontrado.', 404);
  const { data } = await supabaseAdmin().from('credit_sales')
    .select('customer_name,description,sold_on,total,credit_payments(amount,paid_on,created_at)')
    .eq('public_token', token).maybeSingle();
  if (!data) return fail('Extrato não encontrado.', 404);
  return json(publicStatement(data));
}
