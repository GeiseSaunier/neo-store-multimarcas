// Promoções cadastradas no painel (tabela promotions): desconto em % nas peças escolhidas,
// entre starts_at e ends_at. Usado pela vitrine (/api/products) e pelo checkout, para que
// o preço exibido e o cobrado sejam sempre o mesmo.
import { round2 } from './format.js';

// Situação de uma promoção no momento `now`.
export function promoStatus(p, now = new Date()) {
  if (now >= new Date(p.ends_at)) return 'ended';
  if (!p.active) return 'paused';
  if (now < new Date(p.starts_at)) return 'scheduled';
  return 'active';
}

export const promoPrice = (price, percent) => round2(Number(price) * (1 - Number(percent) / 100));

// Promoção de maior desconto que vale agora para a peça (ou null).
export function bestPromo(productId, promos, now = new Date()) {
  let best = null;
  for (const p of promos) {
    if (promoStatus(p, now) !== 'active' || !(p.product_ids || []).includes(productId)) continue;
    if (!best || Number(p.percent) > Number(best.percent)) best = p;
  }
  return best;
}

// Preço do momento: { price, old_price, promo }. Sem promoção, devolve a peça como está.
// Com promoção, o preço riscado é o preço normal da peça, para a etiqueta "−X%" bater com
// o desconto da promoção (o "preço de" cadastrado na peça fica de lado durante a promoção).
export function applyPromo(product, promos, now = new Date()) {
  const promo = bestPromo(product.id, promos, now);
  if (!promo) return { price: Number(product.price), old_price: product.old_price == null ? null : Number(product.old_price), promo: null };
  const base = Number(product.price);
  return {
    price: promoPrice(base, promo.percent),
    old_price: base,
    promo: { id: promo.id, name: promo.name, percent: Number(promo.percent), ends_at: promo.ends_at },
  };
}

// Promoções que podem valer agora (ativas e dentro do período), direto do banco.
export async function loadActivePromos(db, now = new Date()) {
  const iso = now.toISOString();
  const { data, error } = await db.from('promotions').select('*').eq('active', true).lte('starts_at', iso).gt('ends_at', iso);
  if (error) throw error;
  return data || [];
}
