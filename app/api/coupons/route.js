import { supabaseAdmin } from '@/lib/supabase-server';
import { json, fail } from '@/lib/api';
import { tooMany } from '@/lib/ratelimit';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (tooMany(req, 'coupon', 20, 10 * 60e3)) return fail('Muitas tentativas. Aguarde alguns minutos.', 429);
  const code = (new URL(req.url).searchParams.get('code') || '').trim().toUpperCase();
  if (!code) return json({ valid: false });
  const { data } = await supabaseAdmin().from('coupons').select('code,percent,first_purchase').eq('code', code).eq('active', true).maybeSingle();
  return json(data ? { valid: true, code: data.code, percent: Number(data.percent), firstPurchase: data.first_purchase } : { valid: false });
}
