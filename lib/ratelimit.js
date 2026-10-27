import 'server-only';

// Limite simples de tentativas por IP, guardado na memória do servidor.
// Na Vercel cada instância tem a sua memória, então isto segura robôs e abusos
// básicos; para proteção forte, ligue também o Firewall da Vercel (Rate Limiting).
const hits = new Map();

export function tooMany(req, key, max, windowMs) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const k = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(k) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(k, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}
