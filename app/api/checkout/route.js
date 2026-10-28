import { supabaseAdmin } from '@/lib/supabase-server';
import { createPixPayment, createPreference } from '@/lib/mercadopago';
import { quoteCorreios } from '@/lib/shipping';
import { notifyNewOrder, notifyOrderCreated, notifyError } from '@/lib/email';
import { json, fail, siteUrl } from '@/lib/api';
import { onlyDigits, round2, validCpf, brl } from '@/lib/format';
import { applyPromo, loadActivePromos } from '@/lib/promo';
import { STORE, PIX } from '@/lib/config';
import { pixPayload } from '@/lib/pix';
import QRCode from 'qrcode';
import { tooMany } from '@/lib/ratelimit';
import { expireStaleOrders, stockMessage, stockText } from '@/lib/orders';
export const dynamic = 'force-dynamic';

// Quantas peças ainda há para um tamanho (null = estoque não controlado).
function available(p, size) {
  if (p.size_stock) return Number(p.size_stock[size] ?? 0);
  return p.stock;
}

export async function POST(req) {
  if (await tooMany(req, 'checkout', 8, 10 * 60e3)) return fail('Muitas tentativas seguidas. Aguarde alguns minutos ou fale com a gente pelo WhatsApp.', 429);
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
    // Libera o estoque de pedidos abandonados antes de conferir a disponibilidade.
    await expireStaleOrders(db).catch((e) => console.error(e));

    // Evita pedidos em série (robôs ou cliques repetidos) para o mesmo CPF.
    const { count: open } = await db.from('orders').select('id', { count: 'exact', head: true })
      .eq('cpf', cpf).eq('status', 'pending').gt('created_at', new Date(Date.now() - 3600e3).toISOString());
    if (open >= 3) return fail('Você já tem pedidos aguardando pagamento. Conclua um deles ou fale com a gente pelo WhatsApp.', 429);

    // ---------- produtos e preços vêm do banco, nunca do navegador ----------
    const ids = [...new Set(items.map((i) => i.id))];
    const { data: prods, error: pe } = await db.from('products').select('*').in('id', ids).eq('active', true);
    if (pe) throw pe;
    const byId = Object.fromEntries(prods.map((p) => [p.id, p]));
    // igual à vitrine (/api/products): se não der para ler as promoções, vale o preço normal
    const promos = await loadActivePromos(db).catch((e) => { console.error('promoções', e); return []; });
    const lines = [];
    const qtyById = {};
    let couponBase = 0; // valor das peças fora de promoção: só nelas o cupom vale
    for (const it of items) {
      const p = byId[it.id];
      const qty = Math.min(9, Math.max(1, parseInt(it.qty, 10) || 1));
      if (!p) return fail('Uma das peças da sacola não está mais disponível. Atualize a página.');
      const sizes = p.sizes?.length ? p.sizes : ['Único'];
      const size = sizes.includes(it.size) ? it.size : sizes.length === 1 ? sizes[0] : null;
      if (!size) return fail(`Escolha o tamanho de ${p.name}.`);
      const key = p.size_stock ? `${p.id}|${size}` : p.id;
      qtyById[key] = (qtyById[key] || 0) + qty;
      const avail = available(p, size);
      if (avail != null && qtyById[key] > avail) return fail(stockText(p.name, p.size_stock ? size : null, avail));
      // preço do momento (com promoção, se houver); se mudou desde que a cliente abriu a página, avisa
      const { price, promo } = applyPromo(p, promos);
      if (it.price != null && Math.abs(Number(it.price) - price) > 0.009) {
        const why = promo && price < Number(it.price) ? ' (entrou em promoção)' : !promo && price > Number(it.price) ? ' (a promoção terminou)' : '';
        return json({ error: `O preço de ${p.name} mudou para ${brl(price)}${why}. Atualizamos a sacola; confira o novo total.`, prices_changed: true }, 409);
      }
      lines.push({ product_id: p.id, name: p.name, brand: p.brand, brand_label: p.brand_label || null, category: p.category, size, color: it.color || p.colors?.[0] || null, qty, unit_price: price, image: p.images?.[0] || null });
      if (!promo) couponBase += price * qty;
    }
    const subtotal = round2(lines.reduce((s, l) => s + l.unit_price * l.qty, 0));
    couponBase = round2(couponBase);

    // ---------- cupom ----------
    let discount = 0, couponCode = null;
    if (coupon) {
      // Cupom inválido não é ignorado em silêncio: a cliente precisa ver o total sem desconto antes de pagar.
      const code = String(coupon).trim().toUpperCase();
      const { data: c } = await db.from('coupons').select('*').eq('code', code).eq('active', true).maybeSingle();
      if (!c) return json({ error: `O cupom ${code} não está mais disponível. Removemos o desconto; confira o novo total.`, coupon: false }, 400);
      // Cupom não vale em peça em promoção. Só com peças em promoção, segue sem desconto e sem
      // registrar o cupom no pedido. (Para cupom de primeira compra, esse pedido já conta como
      // a primeira compra do CPF.)
      if (couponBase > 0) {
        if (c.first_purchase) {
          const { count: before } = await db.from('orders').select('id', { count: 'exact', head: true })
            .eq('cpf', cpf).in('status', ['pending', 'paid', 'shipped', 'delivered']);
          if (before > 0) return json({ error: `O cupom ${c.code} vale só na primeira compra. Removemos o desconto; confira o novo total.`, coupon: false }, 400);
        }
        couponCode = c.code; discount = round2(couponBase * Number(c.percent) / 100);
      }
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

    // ---------- reserva as peças (no banco, à prova de duas compras ao mesmo tempo) ----------
    const { error: re } = await db.rpc('reserve_stock', { p_order: order.id });
    if (re) {
      await db.from('orders').delete().eq('id', order.id);
      const m = stockMessage(re);
      if (m) return fail(m, 409);
      throw re;
    }

    // ---------- cria o pagamento (PIX direto na conta da loja, ou Mercado Pago) ----------
    const url = siteUrl(req);
    let result, saved = order;
    try {
      if (payment === 'pix' && PIX.direct) {
        // QR e copia e cola com a chave da loja; o "NEO1001" ajuda a achar o pagamento no extrato.
        const qr = pixPayload({ key: PIX.key, name: PIX.name, city: PIX.city, amount: total, txid: `NEO${order.code}` });
        const qrBase64 = (await QRCode.toDataURL(qr, { margin: 1, width: 360 })).split(',')[1];
        const expiresAt = new Date(Date.now() + STORE.pixMinutes * 60e3).toISOString();
        const upd = { pix_direct: true, pix_qr: qr, pix_qr_base64: qrBase64, pix_expires_at: expiresAt };
        await db.from('orders').update(upd).eq('id', order.id);
        saved = { ...order, ...upd };
        result = { payment: 'pix', direct: true, qr, qrBase64, expiresAt };
      } else if (payment === 'pix') {
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
      await notifyError('checkout: não foi possível gerar o pagamento', e, `Pedido #${order.code} foi cancelado automaticamente.`);
      await db.from('orders').update({ status: 'cancelled', notes: `Falha ao gerar pagamento: ${e.message}` }).eq('id', order.id);
      return fail('Não conseguimos gerar o pagamento agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.', 502);
    }

    await Promise.all([notifyNewOrder(saved, lines), notifyOrderCreated(saved, lines, url)]);
    return json({ orderId: order.id, code: order.code, total, ...result });
  } catch (e) {
    await notifyError('checkout: erro ao finalizar pedido', e);
    return fail('Não foi possível finalizar o pedido. Tente novamente.', 500);
  }
}
