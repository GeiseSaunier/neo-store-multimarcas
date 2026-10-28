import { supabaseAdmin } from '@/lib/supabase-server';
import { json, fail, productOut } from '@/lib/api';
import { loadActivePromos } from '@/lib/promo';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = supabaseAdmin();
    const [{ data, error }, promos] = await Promise.all([
      db.from('products').select('*').eq('active', true).order('position', { ascending: true }).order('created_at', { ascending: false }),
      loadActivePromos(db).catch((e) => { console.error('promoções', e); return []; }),
    ]);
    if (error) throw error;
    const products = data.map((p) => productOut(p, promos));
    // promoções com pelo menos uma peça à venda (para a faixa da página inicial)
    const used = new Set(products.map((p) => p.promo?.id).filter(Boolean));
    return json({
      products,
      promos: promos.filter((p) => used.has(p.id)).map((p) => ({ id: p.id, name: p.name, percent: Number(p.percent), ends_at: p.ends_at })),
    });
  } catch (e) {
    console.error(e);
    return fail('Não foi possível carregar os produtos.', 500);
  }
}
