import { supabaseAdmin } from '@/lib/supabase-server';
import { quoteCorreios } from '@/lib/shipping';
import { json, fail } from '@/lib/api';
import { onlyDigits } from '@/lib/format';
import { tooMany } from '@/lib/ratelimit';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (await tooMany(req, 'quote', 40, 10 * 60e3)) return fail('Muitas consultas. Aguarde alguns minutos.', 429);
  try {
    const { cep, items } = await req.json();
    const c = onlyDigits(cep);
    if (c.length !== 8) return fail('CEP inválido.');
    const ids = [...new Set((items || []).map((i) => i.id))];
    const { data: prods } = ids.length ? await supabaseAdmin().from('products').select('id,price').in('id', ids) : { data: [] };
    const price = Object.fromEntries((prods || []).map((p) => [p.id, Number(p.price)]));
    const qty = (items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0) || 1;
    const insurance = (items || []).reduce((s, i) => s + (price[i.id] || 0) * (Number(i.qty) || 0), 0);
    return json({ options: await quoteCorreios({ cep: c, qty, insurance }) });
  } catch (e) {
    console.error(e);
    return fail('Não foi possível calcular o frete.', 500);
  }
}
