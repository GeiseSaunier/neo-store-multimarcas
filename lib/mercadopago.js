import 'server-only';
import crypto from 'node:crypto';

const API = 'https://api.mercadopago.com';

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error('Mercado Pago não configurado: confira MP_ACCESS_TOKEN.');
  return t;
}

async function mp(path, { method = 'GET', body, idempotency } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(idempotency ? { 'X-Idempotency-Key': idempotency } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`Mercado Pago: ${msg}`);
  }
  return data;
}

export async function createPixPayment({ order, siteUrl, minutes }) {
  const [first, ...rest] = order.customer_name.trim().split(/\s+/);
  const expires = new Date(Date.now() + minutes * 60 * 1000);
  return mp('/v1/payments', {
    method: 'POST',
    idempotency: `pix-${order.id}`,
    body: {
      transaction_amount: Number(order.total),
      description: `Pedido Neo Store #${order.code}`,
      payment_method_id: 'pix',
      external_reference: order.id,
      notification_url: `${siteUrl}/api/webhooks/mercadopago?source_news=webhooks`,
      date_of_expiration: expires.toISOString().replace('Z', '-00:00'),
      payer: {
        email: order.email,
        first_name: first,
        last_name: rest.join(' ') || first,
        identification: { type: 'CPF', number: order.cpf },
      },
    },
  });
}

export async function createPreference({ order, siteUrl, method, maxInstallments }) {
  const excluded = method === 'boleto'
    ? [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'bank_transfer' }, { id: 'prepaid_card' }]
    : [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }];
  return mp('/checkout/preferences', {
    method: 'POST',
    body: {
      items: [{ id: order.id, title: `Pedido Neo Store #${order.code}`, quantity: 1, unit_price: Number(order.total), currency_id: 'BRL' }],
      payer: { name: order.customer_name, email: order.email },
      external_reference: order.id,
      notification_url: `${siteUrl}/api/webhooks/mercadopago?source_news=webhooks`,
      back_urls: {
        success: `${siteUrl}/pedido/${order.id}`,
        pending: `${siteUrl}/pedido/${order.id}`,
        failure: `${siteUrl}/pedido/${order.id}`,
      },
      auto_return: 'approved',
      statement_descriptor: 'NEO STORE',
      payment_methods: { installments: maxInstallments, excluded_payment_types: excluded },
    },
  });
}

export const getPayment = (id) => mp(`/v1/payments/${id}`);

// Valida a assinatura enviada pelo Mercado Pago (cabeçalho x-signature).
// Se MP_WEBHOOK_SECRET não estiver configurado, a validação é ignorada.
export function validSignature(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = req.headers.get('x-signature') || '';
  const reqId = req.headers.get('x-request-id') || '';
  const parts = Object.fromEntries(sig.split(',').map((p) => p.trim().split('=').map((s) => s.trim())));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}
