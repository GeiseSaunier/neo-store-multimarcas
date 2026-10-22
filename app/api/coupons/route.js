import { supabaseAdmin } from '@/lib/supabase-server';
import { json } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const code = (new URL(req.url).searchParams.get('code') || '').trim().toUpperCase();
  if (!code) return json({ valid: false });
  const { data } = await supabaseAdmin().from('coupons').select('code,percent').eq('code', code).eq('active', true).maybeSingle();
  return json(data ? { valid: true, code: data.code, percent: Number(data.percent) } : { valid: false });
}
