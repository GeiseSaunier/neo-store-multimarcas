import { supabaseAdmin } from '@/lib/supabase-server';
import { createPixPayment, createPreference } from '@/lib/mercadopago';
import { quoteCorreios } from '@/lib/shipping';
import { notifyNewOrder } from '@/lib/email';
import { json, fail, siteUrl } from '@/lib/api';
import { onlyDigits, round2 } from '@/lib/format';
import { STORE } from '@/lib/config';
export const dynamic = 'force-dynamic';

function validCpf(cpf) {
  const c = onlyDigits(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (len) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return fail('Dados inválidos.'); }
  const { customer = {}, address = {}, items = [], shipping, coupon, payment } = body;

  // ---------- validação ----------
  const name = String(customer.nome || '').trim();
  const email = String(customer.email || '').trim().toLowerCase();
  const phone = onlyDigits(customer.tel);
  const cpf = onlyDigits(customer.cpf);
  if (name.split(/\s+/).length < 2) return fail('Informe o nome completo.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Informe um e-mail válido.');
  if (phone.length < 10) return fail('Informe um celular com DDD.');
  if (!validCpf(cpf)) return fail('CPF inválido. Confira os números.');
  if (!['pix', 'card', 'boleto'].includes(payment)) return fail('Escolha a forma de pagamento.');
  if (!Array.isArray(items) || !items.length || items.length > 30) return fail('Sua sacola está vazia.');
  const addr = {
    cep: onlyDigits(address.cep), rua: String(address.rua || '').trim(), num: String(address.num || '').trim(),
    comp: String(address.comp || '').trim(), bairro: String(address.bairro || '').trim(), cidade: String(address.cidade || '').trim(),
  };
  if (addr.cep.length !== 8 || !addr.rua || !addr.num || !addr.bairro || !addr.cidade) return fail('Preencha o endereço completo.');

  const db = supabaseAdmin();
  try {
    // ---------- produtos e preços vêm do banco, nunca do navegador ----------
    const ids = [...new Set(items.map((i) => i.id))];
    const { data: prods, error: pe } = await db.from('products').select('*').in('id', ids).eq('active', true);
    if (pe) throw pe;
    const byId = Object.fromEntries(prods.map((p) => [p.id, p]));
    const lines = [];
    const qtyById = {};
    for (const it of items) {
      const p = byId[it.id];
      const qty = Math.min(9, Math.max(1, parseInt(it.qty, 10) || 1));
      if (!p) return fail('Uma das peças da sacola não está mais disponível. Atualize a página.');
      const sizes = p.sizes?.length ? p.sizes : ['Único'];
      const size = sizes.includes(it.size) ? it.size : sizes.length === 1 ? sizes[0] : null;
      if (!size) return fail(`Escolha o tamanho de ${p.name}.`);
      qtyById[p.id] = (qtyById[p.id] || 0) + qty;
      if (p.stock != null && qtyById[p.id] > p.stock) return fail(`Temos só ${p.stock} unidade(s) de ${p.name}.`);
      lines.push({ product_id: p.id, name: p.name, brand: p.brand, category: p.category, size, color: it.color || p.colors?.[0] || null, qty, unit_price: Number(p.price), image: p.images?.[0] || null });
    }
    const subtotal = round2(lines.reduce((s, l) => s + l.unit_price * l.qty, 0));

    // ---------- cupom ----------
    let discount = 0, couponCode = null;
    if (coupon) {
      const { data: c } = await db.from('coupons').select('*').eq('code', String(coupon).trim().toUpperCase()).eq('active', true).maybeSingle();
      if (c) { couponCode = c.code; discount = round2(subtotal * Number(c.percent) / 100); }
    }

    // ---------- frete ----------
    let ship;
    if (shipping === 'pac' || shipping === 'sedex') {
      const quotes = await quoteCorreios({ cep: addr.cep, qty: lines.reduce((s, l) => s + l.qty, 0), insurance: subtotal });
      const q = quotes.find((o) => o.id === shipping);
      if (!q) return fail('Não foi possível calcular o frete dos Correios para este CEP. Escolha outra forma de entrega.');
      ship = { id: shipping, label: q.name, cost: q.price, toConfirm: false };
    } else {
      const { data: o } = await db.from('shipping_options').select('*').eq('id', shipping).eq('active', true).maybeSingle();
      if (!o) return fail('Escolha uma forma de entrega.');
      ship = { id: o.id, label: o.name, cost: Number(o.price), toConfirm: o.to_confirm };
    }

    const base = round2(subtotal - discount + ship.cost);
    const pixDiscount = payment === 'pix' ? round2(base * STORE.pixDiscount) : 0;
    const total = round2(base - pixDiscount);
    if (total < 1) return fail('Valor do pedido inválido.');

    // ---------- grava o pedido ----------
    const { data: order, error: oe } = await db.from('orders').insert({
      customer_name: name, email, phone, cpf, address: addr,
      shipping_option: ship.id, shipping_label: ship.label, shipping_cost: ship.cost, shipping_to_confirm: ship.toConfirm,
      subtotal, discount, pix_discount: pixDiscount, total, coupon: couponCode, payment_method: payment,
    }).select().single();
    if (oe) throw oe;
    const { error: ie } = await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (ie) throw ie;

    // ---------- cria o pagamento no Mercado Pago ----------
    const url = siteUrl(req);
    let result;
    try {
      if (payment === 'pix') {
        const pay = await createPixPayment({ order, siteUrl: url, minutes: STORE.pixMinutes });
        const td = pay.point_of_interaction?.transaction_data || {};
        const upd = { mp_payment_id: String(pay.id), mp_status: pay.status, pix_qr: td.qr_code, pix_qr_base64: td.qr_code_base64, pix_expires_at: pay.date_of_expiration };
        await db.from('orders').update(upd).eq('id', order.id);
        result = { payment: 'pix', qr: td.qr_code, qrBase64: td.qr_code_base64, expiresAt: pay.date_of_expiration };
      } else {
        const pref = await createPreference({ order, siteUrl: url, method: payment, maxInstallments: STORE.maxInstallments });
        await db.from('orders').update({ mp_preference_id: pref.id }).eq('id', order.id);
        result = { payment, redirect: pref.init_point };
      }
    } catch (e) {
      console.error(e);
      await db.from('orders').update({ status: 'cancelled', notes: `Falha ao gerar pagamento: ${e.message}` }).eq('id', order.id);
      return fail('Não conseguimos gerar o pagamento agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.', 502);
    }

    await notifyNewOrder(order, lines);
    return json({ orderId: order.id, code: order.code, total, ...result });
  } catch (e) {
    console.error(e);
    return fail('Não foi possível finalizar o pedido. Tente novamente.', 500);
  }
}
