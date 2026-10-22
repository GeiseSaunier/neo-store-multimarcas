import { supabaseAdmin } from '@/lib/supabase-server';
import { json, fail, productOut } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().from('products').select('*').eq('active', true)
      .order('position', { ascending: true }).order('created_at', { ascending: false });
    if (error) throw error;
    return json({ products: data.map(productOut) });
  } catch (e) {
    console.error(e);
    return fail('Não foi possível carregar os produtos.', 500);
  }
}
