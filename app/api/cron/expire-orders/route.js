import { supabaseAdmin } from '@/lib/supabase-server';
import { expireStaleOrders } from '@/lib/orders';
import { notifyError } from '@/lib/email';
import { sweepPhotos } from '@/lib/photos';
import { json, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Rodado pela Vercel (vercel.json > crons) para cancelar pedidos abandonados
// e apagar fotos que ninguém mais usa.
// A Vercel envia "Authorization: Bearer CRON_SECRET" quando a variável existe.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return fail('Sem permissão.', 401);
  try {
    const db = supabaseAdmin();
    const cancelled = await expireStaleOrders(db);
    // limpa contadores de tentativas vencidos
    await db.from('rate_hits').delete().lt('reset_at', new Date().toISOString());
    // apaga fotos que nenhuma peça nem pedido usa (falha aqui não impede o resto)
    const photos = await sweepPhotos(db).catch((e) => notifyError('limpeza de fotos', e).then(() => null));
    return json({ cancelled, photos });
  } catch (e) {
    await notifyError('rotina diária de pedidos', e);
    return fail('Erro ao expirar pedidos.', 500);
  }
}
