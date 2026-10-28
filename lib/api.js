import 'server-only';
import { NextResponse } from 'next/server';
import { applyPromo } from './promo';

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (message, status = 400) => json({ error: message }, status);
export const siteUrl = (req) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

// Peça para a vitrine, já com o preço do momento (promoções ativas em `promos`).
export function productOut(p, promos = []) {
  const { price, old_price, promo } = applyPromo(p, promos);
  return {
    id: p.id, name: p.name, brand: p.brand, brand_label: p.brand_label || null, category: p.category,
    price, old_price, promo,
    description: p.description, details: p.details, sizes: p.sizes?.length ? p.sizes : ['Único'],
    colors: p.colors, images: p.images, stock: p.stock, size_stock: p.size_stock || null,
  };
}
