import 'server-only';
import { NextResponse } from 'next/server';

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (message, status = 400) => json({ error: message }, status);
export const siteUrl = (req) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

export function productOut(p) {
  return {
    id: p.id, name: p.name, brand: p.brand, category: p.category,
    price: Number(p.price), old_price: p.old_price == null ? null : Number(p.old_price),
    description: p.description, details: p.details, sizes: p.sizes?.length ? p.sizes : ['Único'],
    colors: p.colors, images: p.images, stock: p.stock,
  };
}
