// Custo e lucro: quanto entrou de fato por cada peça vendida e quanto ela custou.
// Tudo em centavos por dentro, para as somas baterem com o total do pedido.

const cents = (v) => Math.round(Number(v || 0) * 100);

// Divide `target` centavos entre as partes, na proporção de `weights`, sem perder nenhum
// centavo: o que sobra do arredondamento vai para as partes com maior resto.
function split(target, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (target * w) / sum);
  const out = raw.map(Math.floor);
  let rest = target - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { out[i]++; rest--; } });
  return out;
}

// Quanto entrou por item de um pedido (em reais), sem frete.
// lines: [{ unit_price, qty, promo }]. O cupom só vale nas peças fora de promoção (promo: false)
// e o desconto PIX vale sobre peças + frete, então só a parte das peças sai daqui.
export function allocateNet(lines, { discount = 0, pixDiscount = 0, shipping = 0 }) {
  const gross = lines.map((l) => cents(l.unit_price) * l.qty);
  const coupon = split(cents(discount), lines.map((l, i) => (l.promo ? 0 : gross[i])));
  const after = gross.map((g, i) => g - coupon[i]);
  const goods = after.reduce((a, b) => a + b, 0);
  const pixGoods = goods + cents(shipping) ? Math.round((cents(pixDiscount) * goods) / (goods + cents(shipping))) : 0;
  const pix = split(pixGoods, after);
  return after.map((a, i) => (a - pix[i]) / 100);
}

// Receita de cada item de um pedido já gravado. Pedidos novos trazem net_amount;
// nos antigos, os descontos são divididos na proporção do valor (sem saber quais estavam em promoção).
export function itemsRevenue(order) {
  const items = order.order_items || [];
  if (items.length && items.every((i) => i.net_amount != null)) return items.map((i) => Number(i.net_amount));
  return allocateNet(items.map((i) => ({ unit_price: i.unit_price, qty: i.qty, promo: false })), {
    discount: order.discount, pixDiscount: order.pix_discount, shipping: order.shipping_cost,
  });
}

export const CHANNELS = { site: 'Site', loja: 'Loja', whatsapp: 'WhatsApp', crediario: 'Crediário', outro: 'Outro' };

// Junta compras, pedidos do site e vendas manuais em linhas por item:
// quanto comprou, quanto vendeu, o lucro sobre o que vendeu e o que está parado no estoque.
// costs: { [product_id]: custo atual } — usado quando a venda não guardou o custo do dia.
// products: peças do catálogo (todas entram na lista, mesmo sem compra ou venda).
export function profitReport({ orders = [], manual = [], purchases = [], products = [], costs = {} }) {
  const rows = new Map();
  const keyOf = (product_id, name) => (product_id ? `p:${product_id}` : `n:${name.trim().toLowerCase()}`);
  const row = (key, name) => {
    if (!rows.has(key)) rows.set(key, { key, product_id: key.startsWith('p:') ? key.slice(2) : null, name, qty: 0, byChannel: {}, revenue: 0, cost: 0, noCostQty: 0, noCostRevenue: 0, boughtQty: 0, boughtCost: 0 });
    return rows.get(key);
  };
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  for (const p of products) row(`p:${p.id}`, p.name);
  for (const pu of purchases) {
    for (const i of pu.purchase_items || []) {
      const r = row(keyOf(i.product_id, i.name), byId[i.product_id]?.name || i.name);
      r.boughtQty += i.qty; r.boughtCost += cents(i.unit_cost) * i.qty;
    }
  }
  const add = ({ product_id, name, qty, revenue, unitCost, channel }) => {
    const r = row(keyOf(product_id, name), byId[product_id]?.name || name);
    const c = unitCost ?? (product_id ? costs[product_id] : null) ?? null;
    r.qty += qty;
    r.byChannel[channel] = (r.byChannel[channel] || 0) + qty;
    r.revenue += cents(revenue);
    if (c == null) { r.noCostQty += qty; r.noCostRevenue += cents(revenue); }
    else r.cost += cents(c) * qty;
  };
  for (const o of orders) {
    const rev = itemsRevenue(o);
    (o.order_items || []).forEach((i, k) => add({ product_id: i.product_id, name: i.name, qty: i.qty, revenue: rev[k], unitCost: i.unit_cost, channel: 'site' }));
  }
  for (const m of manual) add({ product_id: m.product_id, name: m.name, qty: m.qty, revenue: Number(m.unit_price) * m.qty, unitCost: m.unit_cost, channel: m.channel });

  // Lucro e margem só com o que tem custo conhecido (venda sem custo não vira lucro de 100%).
  const out = [...rows.values()].map((r) => {
    const known = r.revenue - r.noCostRevenue;
    // Estoque: o da loja, se a peça controla estoque; senão, comprado − vendido (se houve compra).
    const p = byId[r.product_id];
    const controlled = p && (p.stock != null || p.size_stock != null);
    const stock = controlled ? Number(p.stock || 0) : r.boughtQty ? Math.max(0, r.boughtQty - r.qty) : null;
    const unit = (r.product_id ? costs[r.product_id] : null) ?? (r.boughtQty ? r.boughtCost / r.boughtQty / 100 : null);
    return {
      ...r, revenue: r.revenue / 100, cost: r.cost / 100, noCostRevenue: r.noCostRevenue / 100, boughtCost: r.boughtCost / 100,
      profit: (known - r.cost) / 100, margin: known > 0 ? (known - r.cost) / known : null,
      stock, stockValue: stock != null && unit != null ? cents(unit) * stock / 100 : null,
    };
  })
    .filter((r) => r.qty || r.boughtQty || r.stock) // peça sem compra, venda nem estoque não entra
    .sort((a, b) => b.revenue - a.revenue || b.boughtCost - a.boughtCost || a.name.localeCompare(b.name));

  const t = out.reduce((s, r) => ({
    revenue: s.revenue + cents(r.revenue), cost: s.cost + cents(r.cost), noCostRevenue: s.noCostRevenue + cents(r.noCostRevenue), noCostQty: s.noCostQty + r.noCostQty, qty: s.qty + r.qty,
    boughtQty: s.boughtQty + r.boughtQty, boughtCost: s.boughtCost + cents(r.boughtCost), stock: s.stock + (r.stock || 0), stockValue: s.stockValue + cents(r.stockValue || 0),
  }), { revenue: 0, cost: 0, noCostRevenue: 0, noCostQty: 0, qty: 0, boughtQty: 0, boughtCost: 0, stock: 0, stockValue: 0 });
  const known = t.revenue - t.noCostRevenue;
  return {
    rows: out,
    totals: {
      qty: t.qty, revenue: t.revenue / 100, cost: t.cost / 100, profit: (known - t.cost) / 100, margin: known > 0 ? (known - t.cost) / known : null,
      noCostQty: t.noCostQty, noCostRevenue: t.noCostRevenue / 100, boughtQty: t.boughtQty, boughtCost: t.boughtCost / 100, stock: t.stock, stockValue: t.stockValue / 100,
    },
  };
}

// ---------- Calculadora e relatório de vendas (aba "Vendas e lucro") ----------
// Uma linha por venda (item do site ou venda lançada), com quanto paguei, vendi e o lucro.
// Venda sem o valor pago fica fora das contas do balanço (aparece no aviso "falta o valor pago").

// "1250.5" → "1.250,50" (para mostrar no campo depois que a pessoa sai dele).
export const moneyText = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 0.6 → "60%"; 0.3333 → "33,3%".
export const pctText = (p) => `${(Math.round(p * 1000) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

// Resultado de uma peça: kind 'lucro', 'prejuizo' ou 'zero'; pct = lucro ÷ valor pago (null se não custou nada).
export function pieceResult(cost, price) {
  const c = cents(cost), diff = cents(price) - c;
  return { kind: diff > 0 ? 'lucro' : diff < 0 ? 'prejuizo' : 'zero', profit: diff / 100, pct: c > 0 ? diff / c : null };
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
// "2026-11" → "Novembro de 2026"
export const monthLabel = (ym) => `${MONTH_NAMES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
// Meses das datas (AAAA-MM-DD), do mais recente para o mais antigo.
export const monthsOf = (dates) => [...new Set(dates.filter(Boolean).map((d) => d.slice(0, 7)))].sort().reverse();
// period: 'all' ou 'AAAA-MM'.
export const inPeriod = (date, period) => period === 'all' || (date || '').startsWith(period);
// Dia (AAAA-MM-DD) no fuso de quem usa o painel.
export function localDay(iso) {
  const d = new Date(iso), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// orders: pedidos pagos do site; manual: vendas lançadas; costs: custo atual de cada peça do catálogo.
export function saleLines({ orders = [], manual = [], costs = {} }) {
  const line = (x) => {
    const price = cents(x.revenue);
    const cost = x.unitCost == null ? null : cents(x.unitCost) * x.qty;
    return { ...x, price: price / 100, cost: cost == null ? null : cost / 100, profit: cost == null ? null : (price - cost) / 100 };
  };
  const out = [];
  for (const o of orders) {
    const rev = itemsRevenue(o);
    const day = localDay(o.paid_at || o.created_at);
    (o.order_items || []).forEach((i, k) => out.push(line({
      key: `o:${o.id}:${k}`, source: 'site', id: o.id, date: day, created_at: o.paid_at || o.created_at, product_id: i.product_id, name: i.name, size: i.size,
      channel: 'site', qty: i.qty, revenue: rev[k], unitCost: i.unit_cost ?? (i.product_id ? costs[i.product_id] : null) ?? null,
    })));
  }
  for (const m of manual) {
    out.push(line({
      key: `m:${m.id}`, source: 'manual', id: m.id, date: m.sold_on, created_at: m.created_at, product_id: m.product_id, name: m.name, size: m.size,
      channel: m.channel, qty: m.qty, revenue: Number(m.unit_price) * m.qty, unitCost: m.unit_cost ?? (m.product_id ? costs[m.product_id] : null) ?? null,
      stock_taken: m.stock_taken,
    }));
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

// Balanço das linhas de venda (só as que têm o valor pago).
export function salesSummary(lines) {
  const known = lines.filter((l) => l.cost != null);
  const missing = lines.filter((l) => l.cost == null);
  const sum = (list, f) => list.reduce((s, l) => s + f(l), 0);
  const count = sum(known, (l) => l.qty);
  const cost = sum(known, (l) => cents(l.cost)), price = sum(known, (l) => cents(l.price));
  const profit = price - cost;
  // Mais e menos lucro: em empate, fica a venda mais recente (as linhas já vêm nessa ordem).
  const best = known.reduce((a, l) => (!a || l.profit > a.profit ? l : a), null);
  const worst = known.reduce((a, l) => (!a || l.profit < a.profit ? l : a), null);
  return {
    count, lines: known.length,
    cost: cost / 100, price: price / 100, profit: profit / 100,
    kind: profit > 0 ? 'lucro' : profit < 0 ? 'prejuizo' : 'zero',
    pct: cost > 0 ? profit / cost : null,
    average: count ? Math.round(profit / count) / 100 : 0,
    best: known.length >= 2 ? best : null,
    worst: known.length >= 2 ? worst : null,
    missingQty: sum(missing, (l) => l.qty), missingPrice: sum(missing, (l) => cents(l.price)) / 100,
  };
}

const dmy = (d) => d.split('-').reverse().join('/');
// Planilha das vendas do período (números como número; a tela de download põe a vírgula).
export function salesCsv(lines, period = 'all') {
  const s = salesSummary(lines);
  return {
    filename: `neo_store-relatorio-${period === 'all' ? 'todos-os-meses' : period}.csv`,
    header: ['Data', 'Peça', 'Quantidade', 'Onde vendeu', 'Paguei (R$)', 'Vendi (R$)', 'Lucro (R$)'],
    rows: [
      ...lines.map((l) => [dmy(l.date), l.name, String(l.qty), CHANNELS[l.channel] || l.channel, l.cost ?? 'falta', l.price, l.profit ?? '']),
      ['Total', s.missingQty ? `${s.count} com valor pago (${s.missingQty} sem)` : `${s.count} ${s.count === 1 ? 'peça' : 'peças'}`, String(s.count), '', s.cost, s.price, s.profit],
    ],
  };
}
