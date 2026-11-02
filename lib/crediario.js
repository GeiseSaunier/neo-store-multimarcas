// Crediário (vendas a prazo): contas feitas em centavos para não errar no arredondamento.

const cents = (v) => Math.round(Number(v || 0) * 100);

// "1.234,56", "R$ 50", "50,5" ou "50.5" → número; vazio ou inválido → NaN.
export function parseMoney(text) {
  let s = String(text ?? '').replace(/R\$|\s/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // "1.500" = mil e quinhentos
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

// Data de hoje no fuso de quem está usando o painel, como "AAAA-MM-DD".
export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// "2026-11-02" → "02/11/2026", sem passar pelo fuso (new Date mostraria o dia anterior).
export const fmtDay = (d) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

// Resumo de uma venda: pago, falta, situação e o histórico com o saldo depois de cada pagamento.
export function saleSummary(sale) {
  const pays = [...(sale.credit_payments || [])].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || String(a.created_at).localeCompare(String(b.created_at)));
  let left = cents(sale.total);
  const history = pays.map((p) => { left -= cents(p.amount); return { ...p, left: left / 100 }; });
  const paid = cents(sale.total) - left;
  return {
    total: cents(sale.total) / 100,
    paid: paid / 100,
    left: Math.max(0, left) / 100,
    settled: left <= 0,
    last: pays.at(-1) || null,
    history,
  };
}

// O que a cliente vê no link do extrato: só primeiro nome, compra, valores e datas.
// Telefone, observações da venda e dos pagamentos são internos e ficam de fora.
export function publicStatement(sale) {
  const s = saleSummary(sale);
  return {
    first_name: sale.customer_name.trim().split(/\s+/)[0],
    description: sale.description || '',
    sold_on: sale.sold_on,
    total: s.total, paid: s.paid, left: s.left, settled: s.settled,
    payments: s.history.map((p) => ({ amount: Number(p.amount), paid_on: p.paid_on, left: p.left })),
  };
}

// Soma dos pagamentos feitos no mês de `day` ("AAAA-MM-DD").
export function receivedInMonth(sales, day) {
  const m = day.slice(0, 7);
  return sales.reduce((s, sale) => s + (sale.credit_payments || []).filter((p) => p.paid_on.startsWith(m)).reduce((a, p) => a + cents(p.amount), 0), 0) / 100;
}

// Mensagem amigável para os erros do banco do crediário.
export function creditError(error, fallback) {
  const m = /CREDIARIO_EXCEDE\|(-?[\d.]+)/.exec(error?.message || '');
  if (m) return Number(m[1]) > 0 ? `O valor passa do que falta (${Number(m[1]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).` : 'O valor da venda não pode ficar menor do que o que já foi pago.';
  return fallback;
}
