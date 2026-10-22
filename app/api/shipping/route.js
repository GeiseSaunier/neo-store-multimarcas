import { supabaseAdmin } from '@/lib/supabase-server';
import { correiosEnabled } from '@/lib/shipping';
import { json, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().from('shipping_options').select('*').eq('active', true).order('position');
    if (error) throw error;
    return json({
      correios: correiosEnabled(),
      regional: data.map((o) => ({ id: o.id, name: o.name, description: o.description, price: Number(o.price), price_label: o.price_label, to_confirm: o.to_confirm })),
    });
  } catch (e) {
    console.error(e);
    return fail('Não foi possível carregar as opções de entrega.', 500);
  }
}
