import 'server-only';
import { supabaseAdmin } from './supabase-server.js';

// Limite de tentativas por IP. Fica no banco (função rate_hit) para valer em todos os
// servidores da Vercel ao mesmo tempo; se o banco falhar, usa a memória do servidor.
// Para proteção extra contra ataques grandes, ligue também o Firewall da Vercel.
const hits = new Map();

export function clientIp(req) {
  return req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}

export function tooManyInMemory(key, max, windowMs, now = Date.now()) {
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export async function tooMany(req, bucket, max, windowMs, db) {
  const key = `${bucket}:${clientIp(req)}`;
  try {
    const { data, error } = await (db || supabaseAdmin()).rpc('rate_hit', { p_key: key, p_max: max, p_window: Math.ceil(windowMs / 1000) });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error('rate_hit', e?.message || e);
    return tooManyInMemory(key, max, windowMs);
  }
}
