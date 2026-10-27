import { supabaseAdmin } from '@/lib/supabase-server';
import { expireStaleOrders } from '@/lib/orders';
import { json, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Rodado pela Vercel (vercel.json > crons) para cancelar pedidos abandonados.
// A Vercel envia "Authorization: Bearer CRON_SECRET" quando a variável existe.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return fail('Sem permissão.', 401);
  try {
    return json({ cancelled: await expireStaleOrders(supabaseAdmin()) });
  } catch (e) {
    console.error(e);
    return fail('Erro ao expirar pedidos.', 500);
  }
}
