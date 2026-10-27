import 'server-only';
import { brl } from './format';
import { STATUS, PAYMENT_LABEL, STORE } from './config';

// Envio de e-mails pelo Resend (https://resend.com). Sem RESEND_API_KEY, nada é enviado.
async function send({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return { skipped: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
    });
    if (!res.ok) console.error('Resend', res.status, await res.text());
    return { ok: res.ok };
  } catch (e) {
    console.error('Resend', e);
    return { ok: false };
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, body) {
  return `<div style="background:#EFE3DC;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#4A3E37">
  <div style="max-width:560px;margin:auto;background:#F8F2EE;border-radius:6px;padding:32px">
  <div style="font-family:Georgia,serif;font-size:22px;color:#73625A;letter-spacing:.04em">NEO STORE <span style="font-size:11px;letter-spacing:.3em">MULTIMARCAS</span></div>
  <h1 style="font-family:Georgia,serif;font-weight:400;color:#73625A;font-size:26px;margin:24px 0 12px">${title}</h1>${body}
  <p style="font-size:12px;color:#8A7A70;margin-top:28px">Dúvidas? Fale com a gente no WhatsApp ${STORE.whatsappLabel}.</p></div></div>`;
}

function itemsTable(order, items) {
  const rows = items.map((i) => `<tr><td style="padding:6px 0">${i.qty}× ${esc(i.name)}${i.size && i.size !== 'Único' ? ` · Tam. ${esc(i.size)}` : ''}</td><td style="text-align:right">${brl(i.unit_price * i.qty)}</td></tr>`).join('');
  return `<table style="width:100%;font-size:14px;border-collapse:collapse">${rows}
  <tr><td style="padding-top:10px;border-top:1px solid #ddd">Frete (${esc(order.shipping_label)})</td><td style="text-align:right;padding-top:10px;border-top:1px solid #ddd">${order.shipping_to_confirm ? 'A combinar' : brl(order.shipping_cost)}</td></tr>
  ${Number(order.discount) ? `<tr><td>Cupom ${esc(order.coupon)}</td><td style="text-align:right">− ${brl(order.discount)}</td></tr>` : ''}
  ${Number(order.pix_discount) ? `<tr><td>Desconto PIX</td><td style="text-align:right">− ${brl(order.pix_discount)}</td></tr>` : ''}
  <tr><td style="font-weight:bold;padding-top:8px">Total</td><td style="text-align:right;font-weight:bold;padding-top:8px">${brl(order.total)}</td></tr></table>`;
}

const adminEmails = () => (process.env.ADMIN_NOTIFY_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
const panel = () => `${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin/pedidos`;

export function notifyNewOrder(order, items) {
  return send({
    to: adminEmails(),
    subject: `Novo pedido #${order.code} · ${brl(order.total)} · ${PAYMENT_LABEL[order.payment_method]}`,
    html: layout(`Novo pedido #${order.code}`, `<p><b>${esc(order.customer_name)}</b> · ${esc(order.phone)} · ${esc(order.address?.cidade || '')}</p><p>Aguardando pagamento por ${PAYMENT_LABEL[order.payment_method]}.</p>${itemsTable(order, items)}<p><a href="${panel()}" style="color:#73625A">Abrir no painel</a></p>`),
  });
}

// Alerta para vocês quando algo importante falha no servidor (checkout, pagamento, webhook).
// No máximo um e-mail a cada 15 minutos para cada tipo de falha, para não lotar a caixa.
const lastAlert = new Map();
export async function notifyError(where, error, extra = '') {
  console.error(where, error);
  const now = Date.now();
  if (now - (lastAlert.get(where) || 0) < 15 * 60e3) return;
  lastAlert.set(where, now);
  const msg = esc(error?.message || String(error));
  return send({
    to: adminEmails(),
    subject: `Erro na loja: ${where}`,
    html: layout('Algo deu errado na loja', `<p><b>${esc(where)}</b></p><p style="font-family:monospace;font-size:13px;background:#fff;padding:10px;border-radius:4px">${msg}</p>${extra ? `<p>${esc(extra)}</p>` : ''}<p>Os detalhes completos ficam em Vercel &gt; Logs. Se o erro se repetir, as clientes podem não estar conseguindo comprar.</p>`),
  });
}

// Para a cliente, assim que o pedido é criado: link para pagar caso feche a janela do PIX ou desista no Mercado Pago.
export function notifyOrderCreated(order, items, siteUrl) {
  const link = `${siteUrl}/pedido/${order.id}`;
  const how = {
    pix: `Use o QR Code ou o código PIX copia e cola em até ${STORE.pixMinutes} minutos. Se fechou a janela, ele continua disponível no link abaixo.`,
    card: 'Se o pagamento com cartão não foi concluído, fale com a gente pelo WhatsApp para gerar um novo link.',
    boleto: 'O boleto compensa em até 2 dias úteis após o pagamento. Avisamos assim que for confirmado.',
  }[order.payment_method];
  return send({
    to: order.email,
    subject: `Recebemos seu pedido #${order.code} · Neo Store`,
    html: layout(`Pedido #${order.code} recebido`, `<p>Olá, ${esc(order.customer_name.split(' ')[0])}! Seu pedido foi registrado e as peças estão reservadas, aguardando o pagamento por ${PAYMENT_LABEL[order.payment_method]}.</p><p>${how}</p>${itemsTable(order, items)}<p style="margin-top:20px"><a href="${link}" style="display:inline-block;background:#73625A;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Ver pedido e pagamento</a></p>`),
  });
}

export function notifyPaid(order, items) {
  return Promise.all([
    send({
      to: adminEmails(),
      subject: `Pagamento confirmado · pedido #${order.code} · ${brl(order.total)}`,
      html: layout(`Pagamento confirmado #${order.code}`, `${order.stock_issue ? `<p style="background:#F6DDD8;color:#A0493B;padding:12px;border-radius:4px"><b>Atenção: estoque insuficiente.</b> O pagamento chegou depois de a peça ter sido vendida para outra cliente. ${esc(order.stock_issue)}. Fale com a cliente antes de separar o pedido.</p>` : ''}<p><b>${esc(order.customer_name)}</b> pagou ${brl(order.total)} por ${PAYMENT_LABEL[order.payment_method]}. Entrega: ${esc(order.shipping_label)}.</p>${itemsTable(order, items)}<p><a href="${panel()}" style="color:#73625A">Separar pedido no painel</a></p>`),
    }),
    send({
      to: order.email,
      subject: `Recebemos seu pagamento · pedido #${order.code}`,
      html: layout(`Obrigada pela compra, ${esc(order.customer_name.split(' ')[0])}!`, `<p>O pagamento do pedido <b>#${order.code}</b> foi confirmado e já estamos separando suas peças.</p>${itemsTable(order, items)}<p>Avisaremos assim que o pedido sair para entrega.</p>`),
    }),
  ]);
}

export function notifyStatus(order) {
  if (!['shipped', 'delivered'].includes(order.status)) return;
  const tracking = order.tracking_code ? `<p>Código de rastreio: <b>${esc(order.tracking_code)}</b></p>` : '';
  return send({
    to: order.email,
    subject: `Pedido #${order.code}: ${STATUS[order.status].label.toLowerCase()}`,
    html: layout(order.status === 'shipped' ? 'Seu pedido está a caminho' : 'Pedido entregue', `<p>O pedido <b>#${order.code}</b> foi ${order.status === 'shipped' ? 'enviado' : 'entregue'}${order.status === 'shipped' ? ` por ${esc(order.shipping_label)}` : ''}.</p>${tracking}`),
  });
}
