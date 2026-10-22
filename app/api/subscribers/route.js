import { supabaseAdmin } from '@/lib/supabase-server';
import { json, fail } from '@/lib/api';
import { onlyDigits } from '@/lib/format';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { channel, contact } = await req.json();
    let value = String(contact || '').trim();
    if (channel === 'email') {
      value = value.toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(value)) return fail('E-mail inválido.');
    } else if (channel === 'whatsapp') {
      value = onlyDigits(value);
      if (value.length < 10 || value.length > 11) return fail('WhatsApp inválido.');
    } else return fail('Canal inválido.');
    const { error } = await supabaseAdmin().from('subscribers').upsert({ channel, contact: value }, { onConflict: 'channel,contact', ignoreDuplicates: true });
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return fail('Não foi possível concluir a inscrição.', 500);
  }
}
