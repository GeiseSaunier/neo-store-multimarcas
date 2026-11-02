'use client';
// Custo e lucro: por quanto cada item foi comprado para revenda, por quanto foi vendido
// (site + vendas fora do site), o lucro e o que ainda está no estoque.
// Resumo por item, lista de compras e lista de vendas fora do site em abas;
// os formulários de lançar compra e venda abrem numa gaveta lateral.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../_ctx';
import { brl } from '@/lib/format';
import { PAID_STATUSES } from '@/lib/config';
import { downloadCsv } from '@/lib/csv';
import { parseMoney, today, fmtDay } from '@/lib/crediario';
import { profitReport, CHANNELS } from '@/lib/lucro';

const pct = (m) => (m == null ? '—' : `${Math.round(m * 100)}%`);
const money = (v) => String(v).replace('.', ',');
const OFF = '__fora__'; // peça fora do catálogo
const PERIODS = [['all', 'Desde o início'], ['year', 'Este ano'], ['month', 'Este mês']];
const pcs = (n) => `${n} ${n === 1 ? 'peça' : 'peças'}`;
const controls = (p) => p && (p.stock != null || p.size_stock != null);
const sizeText = (s) => (s && s !== 'Único' ? ` (${s})` : '');

function channelsText(byChannel) {
  return Object.entries(byChannel).map(([k, n]) => `${CHANNELS[k] || k} ${n}`).join(' · ');
}

// ---------- gaveta lateral ----------
function Drawer({ title, subtitle, onClose, children }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="head">
          <div><h2>{title}</h2>{subtitle && <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{subtitle}</p>}</div>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="body">{children}</div>
      </aside>
    </>
  );
}

function CostInput({ productId, onSaved }) {
  const { sb } = useAdmin();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  async function save(e) {
    e.preventDefault();
    const c = parseMoney(v);
    if (!(c >= 0)) return setErr('Valor inválido');
    const { error } = await sb.from('product_costs').upsert({ product_id: productId, cost: c });
    if (error) return setErr('Não salvou');
    setErr(''); onSaved();
  }
  return (
    <form onSubmit={save} className="cost-inline">
      <input className="input" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="Paguei R$" aria-label="Quanto pagou por esta peça" />
      <button className="btn small ghost">Salvar</button>
      {err && <span className="err">{err}</span>}
    </form>
  );
}

// Escolha da peça (catálogo ou fora dele) + tamanho, usada na compra e na venda.
function PiecePicker({ products, value, onChange, idp }) {
  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const p = products.find((x) => x.id === value.product);
  const sizes = p?.sizes?.length ? p.sizes : ['Único'];
  return (
    <>
      <div className="field"><label htmlFor={`${idp}-p`}>Peça</label>
        <select id={`${idp}-p`} value={value.product} onChange={(e) => {
          const np = products.find((x) => x.id === e.target.value);
          onChange({ product: e.target.value, name: '', size: np?.sizes?.length > 1 ? '' : np?.sizes?.[0] || '' }, { np });
        }}>
          <option value="">Escolha a peça…</option>
          {sorted.map((x) => <option key={x.id} value={x.id}>{x.name}{x.active ? '' : ' (fora da loja)'}</option>)}
          <option value={OFF}>Outra peça (não está no catálogo)</option>
        </select>
      </div>
      {value.product === OFF && <div className="field"><label htmlFor={`${idp}-n`}>Nome da peça</label><input id={`${idp}-n`} value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ex.: Cinto de couro" /></div>}
      {p && sizes.length > 1 && (
        <div className="field"><label htmlFor={`${idp}-s`}>Tamanho</label>
          <select id={`${idp}-s`} value={value.size} onChange={(e) => onChange({ size: e.target.value })}><option value="">Escolha…</option>{sizes.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </div>
      )}
    </>
  );
}

// Confere a peça escolhida; devolve { error } ou os campos prontos para gravar.
function pieceRow(products, v) {
  if (!v.product) return { error: 'Escolha a peça.' };
  if (v.product === OFF) return v.name.trim() ? { product_id: null, name: v.name.trim(), size: null } : { error: 'Digite o nome da peça.' };
  const p = products.find((x) => x.id === v.product);
  const sizes = p.sizes?.length ? p.sizes : ['Único'];
  if (sizes.length > 1 && !v.size) return { error: `Escolha o tamanho de ${p.name}.` };
  return { product_id: p.id, name: p.name, size: v.size || sizes[0] };
}

// ---------- lançar compra ----------
function NewPurchase({ products, onDone }) {
  const { sb } = useAdmin();
  const line = () => ({ product: '', name: '', size: '', qty: '1', cost: '' });
  const [head, setHead] = useState({ supplier: '', bought_on: today(), notes: '' });
  const [lines, setLines] = useState([line()]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setLine = (i, patch) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (parseMoney(l.cost) || 0) * (parseInt(l.qty, 10) || 0), 0);

  async function add(e) {
    e.preventDefault(); setErr('');
    if (!head.bought_on) return setErr('Escolha a data da compra.');
    const items = [];
    for (const [i, l] of lines.entries()) {
      const where = lines.length > 1 ? `Peça ${i + 1}: ` : '';
      const r = pieceRow(products, l);
      if (r.error) return setErr(where + r.error);
      const qty = parseInt(l.qty, 10), cost = parseMoney(l.cost);
      if (!(qty > 0 && qty <= 999)) return setErr(`${where}a quantidade precisa ser de 1 a 999.`);
      if (!(cost >= 0)) return setErr(`${where}digite quanto pagou por cada uma, ex.: 380,00.`);
      items.push({ ...r, qty, unit_cost: cost });
    }
    setBusy(true);
    const { data: pu, error } = await sb.from('purchases').insert({ supplier: head.supplier.trim(), bought_on: head.bought_on, notes: head.notes.trim() || null }).select('id').single();
    if (error) { setBusy(false); return setErr('Não foi possível salvar a compra.'); }
    const { error: ie } = await sb.from('purchase_items').insert(items.map((it) => ({ ...it, purchase_id: pu.id })));
    if (ie) { await sb.from('purchases').delete().eq('id', pu.id); setBusy(false); return setErr('Não foi possível salvar as peças da compra.'); }
    setBusy(false);
    const noStock = items.filter((it) => it.product_id && !controls(products.find((p) => p.id === it.product_id)));
    onDone(`Compra de ${brl(total)} lançada.${noStock.length ? ` ${noStock.map((x) => x.name).join(', ')} não controla estoque na loja: para controlar, preencha o estoque no cadastro da peça.` : ' As peças entraram no estoque.'}`);
  }

  return (
    <form onSubmit={add} style={{ display: 'grid', gap: 16 }}>
      <div className="row">
        <div className="field"><label htmlFor="pu-d">Data da compra</label><input id="pu-d" type="date" value={head.bought_on} onChange={(e) => setHead((h) => ({ ...h, bought_on: e.target.value }))} /></div>
        <div className="field"><label htmlFor="pu-f">Fornecedor (opcional)</label><input id="pu-f" value={head.supplier} onChange={(e) => setHead((h) => ({ ...h, supplier: e.target.value }))} placeholder="Ex.: Capodarte" /></div>
      </div>
      {lines.map((l, i) => {
        const p = products.find((x) => x.id === l.product);
        const sub = (parseMoney(l.cost) || 0) * (parseInt(l.qty, 10) || 0);
        return (
          <fieldset key={i} className="buy-line">
            <legend>{lines.length > 1 ? `Peça ${i + 1}` : 'Peça comprada'}</legend>
            <div className="row">
              <PiecePicker products={products} value={l} idp={`pu${i}`} onChange={(patch) => setLine(i, patch)} />
            </div>
            <div className="row">
              <div className="field"><label htmlFor={`pu${i}-q`}>Quantidade</label><input id={`pu${i}-q`} inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></div>
              <div className="field"><label htmlFor={`pu${i}-c`}>Paguei por cada uma (R$)</label><input id={`pu${i}-c`} inputMode="decimal" value={l.cost} onChange={(e) => setLine(i, { cost: e.target.value })} placeholder="0,00" /></div>
            </div>
            <div className="buy-foot">
              <span className="muted">{sub > 0 ? `Subtotal: ${brl(sub)}` : ''}{p && !controls(p) ? `${sub > 0 ? ' · ' : ''}esta peça não controla estoque na loja` : ''}</span>
              {lines.length > 1 && <button type="button" className="linkish" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>Tirar esta peça</button>}
            </div>
          </fieldset>
        );
      })}
      <div><button type="button" className="btn small ghost" onClick={() => setLines((ls) => [...ls, line()])}>+ Outra peça nesta compra</button></div>
      <div className="field"><label htmlFor="pu-o">Observação (opcional)</label><input id="pu-o" value={head.notes} onChange={(e) => setHead((h) => ({ ...h, notes: e.target.value }))} placeholder="Ex.: nota 1234, paguei no boleto" /></div>
      <div className="drawer-actions">
        <div className="tot-line"><span>Total da compra</span><b>{brl(total)}</b></div>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn solid" disabled={busy}>{busy ? 'Salvando…' : 'Salvar compra'}</button>
      </div>
    </form>
  );
}

// ---------- lançar venda fora do site ----------
function ManualSale({ products, costs, onDone }) {
  const { sb } = useAdmin();
  const [f, setF] = useState({ product: '', name: '', size: '', qty: '1', price: '', cost: '', channel: 'loja', sold_on: today(), notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const p = products.find((x) => x.id === f.product);
  const sizes = p?.sizes?.length ? p.sizes : ['Único'];
  const avail = controls(p) ? (p.size_stock ? Number(p.size_stock[f.size || sizes[0]] ?? 0) : p.stock) : null;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const qty = parseInt(f.qty, 10) || 0, price = parseMoney(f.price), cost = parseMoney(f.cost);
  const preview = qty > 0 && price >= 0 && cost >= 0 ? (price - cost) * qty : null;

  async function add(e) {
    e.preventDefault(); setErr('');
    const r = pieceRow(products, f);
    if (r.error) return setErr(r.error);
    const c = f.cost.trim() ? cost : null;
    if (!(qty > 0 && qty <= 99)) return setErr('A quantidade precisa ser de 1 a 99.');
    if (!(price >= 0)) return setErr('Digite por quanto vendeu cada uma, ex.: 690,00.');
    if (c !== null && !(c >= 0)) return setErr('O custo precisa ser um valor, ex.: 380,00.');
    if (!f.sold_on) return setErr('Escolha a data da venda.');
    setBusy(true);
    const { data, error } = await sb.from('manual_sales').insert({ ...r, qty, unit_price: price, unit_cost: c, channel: f.channel, sold_on: f.sold_on, notes: f.notes.trim() || null }).select('stock_taken').single();
    setBusy(false);
    if (error) return setErr('Não foi possível lançar a venda.');
    const short = avail != null && data.stock_taken < qty;
    onDone(short ? `Venda lançada. Atenção: o estoque só tinha ${data.stock_taken}; confira o estoque da peça.` : `Venda de ${brl(price * qty)} lançada${avail != null ? ' e estoque atualizado' : ''}.`);
  }

  return (
    <form onSubmit={add} style={{ display: 'grid', gap: 16 }}>
      <div className="row">
        <PiecePicker products={products} value={f} idp="ms" onChange={(patch, picked) => setF((s) => ({ ...s, ...patch, ...(picked ? { price: picked.np ? money(picked.np.price) : '', cost: picked.np && costs[picked.np.id] != null ? money(costs[picked.np.id]) : '' } : {}) }))} />
      </div>
      <div className="row">
        <div className="field"><label htmlFor="ms-q">Quantidade</label><input id="ms-q" inputMode="numeric" value={f.qty} onChange={set('qty')} />
          {avail != null && <span className="help">Tem {avail} no estoque</span>}</div>
        <div className="field"><label htmlFor="ms-d">Data da venda</label><input id="ms-d" type="date" value={f.sold_on} onChange={set('sold_on')} /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="ms-v">Vendi cada uma por (R$)</label><input id="ms-v" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="0,00" /><span className="help">Já com o desconto que você deu.</span></div>
        <div className="field"><label htmlFor="ms-c">Paguei por cada uma (R$)</label><input id="ms-c" inputMode="decimal" value={f.cost} onChange={set('cost')} placeholder="0,00" />
          <span className="help">{p && costs[p.id] == null ? 'Sem compra lançada: digite aqui, se souber.' : p ? 'Veio da última compra.' : ''}</span></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="ms-ch">Onde vendeu</label>
          <select id="ms-ch" value={f.channel} onChange={set('channel')}>{['loja', 'whatsapp', 'crediario', 'outro'].map((c) => <option key={c} value={c}>{CHANNELS[c]}</option>)}</select></div>
        <div className="field"><label htmlFor="ms-o">Observação (opcional)</label><input id="ms-o" value={f.notes} onChange={set('notes')} placeholder="Ex.: cliente Maria" /></div>
      </div>
      <div className="drawer-actions">
        {preview != null && f.cost.trim() && <div className="tot-line"><span>Lucro desta venda</span><b style={{ color: preview < 0 ? 'var(--bad)' : undefined }}>{brl(preview)}</b></div>}
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn solid" disabled={busy}>{busy ? 'Salvando…' : 'Salvar venda'}</button>
      </div>
    </form>
  );
}

// ---------- página ----------
export default function Lucro() {
  const { sb, ask } = useAdmin();
  const [tab, setTab] = useState('items');
  const [period, setPeriod] = useState('all');
  const [drawer, setDrawer] = useState(null); // 'purchase' | 'sale'
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [o, m, pu, p, c] = await Promise.all([
      sb.from('orders').select('id,paid_at,created_at,discount,pix_discount,shipping_cost,order_items(product_id,name,qty,unit_price,unit_cost,net_amount)').in('status', PAID_STATUSES),
      sb.from('manual_sales').select('*').order('sold_on', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('purchases').select('*, purchase_items(*)').order('bought_on', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('products').select('id,name,price,sizes,stock,size_stock,active'),
      sb.from('product_costs').select('product_id,cost'),
    ]);
    const e = o.error || m.error || pu.error || p.error || c.error;
    if (e) { setErr('Não foi possível carregar os dados. Confira se o banco foi atualizado com o supabase/schema.sql.'); setData({ orders: [], manual: [], purchases: [], products: [], costs: {} }); return; }
    setErr('');
    setData({ orders: o.data, manual: m.data, purchases: pu.data, products: p.data, costs: Object.fromEntries(c.data.map((x) => [x.product_id, Number(x.cost)])) });
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 8000); return () => clearTimeout(t); }, [notice]);

  // Período: compras pela data da compra, vendas do site pela data do pagamento, fora do site pela data lançada.
  const inPeriod = useMemo(() => {
    if (!data) return null;
    const d = today(), from = period === 'month' ? d.slice(0, 7) : period === 'year' ? d.slice(0, 4) : '';
    const ok = (day) => !from || (day || '').startsWith(from);
    return {
      ...data,
      orders: data.orders.filter((o) => ok(today(new Date(o.paid_at || o.created_at)))),
      manual: data.manual.filter((s) => ok(s.sold_on)),
      purchases: data.purchases.filter((pu) => ok(pu.bought_on)),
    };
  }, [data, period]);
  const report = useMemo(() => (inPeriod ? profitReport(inPeriod) : null), [inPeriod]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (report?.rows || []).filter((r) => !t || r.name.toLowerCase().includes(t));
  }, [report, q]);

  const done = (message) => { setDrawer(null); setNotice(message); load(); };
  async function removePurchase(pu) {
    const back = (pu.purchase_items || []).reduce((s, i) => s + i.stock_added, 0);
    if (!(await ask({ title: `Excluir a compra de ${fmtDay(pu.bought_on)}${pu.supplier ? ` (${pu.supplier})` : ''}?`, message: `${back ? `${pcs(back)} ${back === 1 ? 'sai' : 'saem'} do estoque (sem ficar negativo, se já vendeu). ` : ''}O valor pago das peças continua o mesmo no cadastro.`, confirmLabel: 'Excluir compra', danger: true }))) return;
    const { error } = await sb.from('purchases').delete().eq('id', pu.id);
    if (error) setErr('Não foi possível excluir a compra.'); else { setNotice('Compra excluída.'); load(); }
  }
  async function removeManual(s) {
    if (!(await ask({ title: `Excluir a venda de ${s.qty}× ${s.name}?`, message: s.stock_taken > 0 ? `${s.stock_taken === 1 ? 'A peça volta' : `As ${s.stock_taken} peças voltam`} para o estoque.` : 'Ela sai da conta do lucro.', confirmLabel: 'Excluir venda', danger: true }))) return;
    const { error } = await sb.from('manual_sales').delete().eq('id', s.id);
    if (error) setErr('Não foi possível excluir a venda.'); else { setNotice('Venda excluída.'); load(); }
  }
  function exportCsv() {
    downloadCsv(`custo-e-lucro-${today()}.csv`,
      ['Item', 'Comprei (peças)', 'Paguei (R$)', 'Vendi (peças)', 'Recebi (R$)', 'Onde vendeu', 'Custo do que vendi', 'Lucro', 'Margem', 'Ainda no estoque', 'Valor no estoque', 'Vendidas sem custo'],
      rows.map((r) => [r.name, r.boughtQty, r.boughtCost, r.qty, r.revenue, channelsText(r.byChannel), r.cost, r.profit, r.margin == null ? '' : Math.round(r.margin * 100) + '%', r.stock ?? '', r.stockValue ?? '', r.noCostQty || '']));
  }

  const t = report?.totals;
  const label = PERIODS.find(([k]) => k === period)[1].toLowerCase();
  const empty = data && !data.purchases.length && !data.manual.length && !data.orders.length;

  return (
    <>
      <div className="page-head">
        <div><h1>Custo e lucro</h1><p>Quanto você pagou pelas peças, quanto recebeu ao vender e quanto sobrou de lucro.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn solid" onClick={() => setDrawer('purchase')} disabled={!data}>+ Lançar compra</button>
          <button className="btn ghost" onClick={() => setDrawer('sale')} disabled={!data}>+ Lançar venda</button>
        </div>
      </div>

      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
      {err && <div className="alert">{err}</div>}

      {!report ? <div className="empty"><span className="mono" />Carregando…</div> : empty ? (
        <div className="card start">
          <h2>Comece por aqui</h2>
          <ol>
            <li><b>Lance as compras</b> de mercadoria: qual peça, quantas e quanto pagou em cada. Elas entram no estoque.</li>
            <li><b>As vendas do site entram sozinhas.</b> O que vender na loja, pelo WhatsApp ou no crediário, lance em “Lançar venda”.</li>
            <li>Aqui aparece, para cada peça, <b>quanto pagou, quanto recebeu e o lucro</b>.</li>
          </ol>
          <button className="btn solid" onClick={() => setDrawer('purchase')}>+ Lançar a primeira compra</button>
        </div>
      ) : (<>
        <div className="profit-bar">
          <div className="seg" role="tablist" aria-label="O que ver">
            {[['items', 'Resumo por peça'], ['purchases', 'Compras', inPeriod.purchases.length], ['sales', 'Vendas fora do site', inPeriod.manual.length]].map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}{n != null && <span className="n">{n}</span>}</button>
            ))}
          </div>
          <label className="period">Período
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
        </div>

        <div className="kpis profit-kpis">
          <div className="kpi"><div className="lbl">Paguei nas compras</div><div className="v">{brl(t.boughtCost)}</div><div className="s">{pcs(t.boughtQty)} compradas</div></div>
          <div className="kpi"><div className="lbl">Recebi nas vendas</div><div className="v">{brl(t.revenue)}</div><div className="s">{pcs(t.qty)} vendidas</div></div>
          <div className="kpi hl"><div className="lbl">Lucro</div><div className="v" style={{ color: t.profit < 0 ? 'var(--bad)' : undefined }}>{brl(t.profit)}</div><div className="s">recebi − o que paguei pelas peças vendidas{t.margin != null ? ` · ${pct(t.margin)}` : ''}</div></div>
          <div className="kpi"><div className="lbl">Ainda no estoque</div><div className="v">{brl(t.stockValue)}</div><div className="s">{pcs(t.stock)} esperando venda</div></div>
        </div>

        {t.noCostQty > 0 && tab === 'items' && (
          <div className="alert warn">
            {pcs(t.noCostQty)} {t.noCostQty === 1 ? 'vendida não tem' : 'vendidas não têm'} o valor que você pagou ({brl(t.noCostRevenue)} recebidos). Sem esse valor, elas ficam fora do lucro. Digite quanto pagou na coluna “Lucro” da peça, ou lance a compra dela.
          </div>
        )}

        {tab === 'items' && (<>
          <div className="list-tools">
            <input className="input" placeholder="Buscar peça" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn small ghost" onClick={exportCsv} disabled={!rows.length}>Exportar planilha</button>
          </div>
          {rows.length ? (
            <div className="table-wrap"><table className="t profit-table">
              <thead><tr><th>Peça</th><th className="num">Comprei</th><th className="num">Vendi</th><th className="num">Lucro</th><th className="num">No estoque</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.key} style={{ cursor: 'default' }}>
                  <td><b className="pname">{r.name}</b>{r.qty > 0 && <small className="sub">vendeu: {channelsText(r.byChannel)}</small>}</td>
                  <td className="num">{r.boughtQty ? <>{pcs(r.boughtQty)}<small className="sub">paguei {brl(r.boughtCost)}</small></> : <span className="muted">—</span>}</td>
                  <td className="num">{r.qty ? <>{pcs(r.qty)}<small className="sub">recebi {brl(r.revenue)}</small></> : <span className="muted">—</span>}</td>
                  <td className="num">
                    {r.qty === 0 ? <span className="muted">—</span> : r.margin == null ? (
                      r.product_id && data.costs[r.product_id] == null ? <CostInput productId={r.product_id} onSaved={() => { setNotice(`Valor pago de ${r.name} salvo.`); load(); }} /> : <span className="muted">falta o valor pago</span>
                    ) : (<>
                      <b style={{ color: r.profit < 0 ? 'var(--bad)' : 'var(--ok)' }}>{brl(r.profit)}</b>
                      <small className="sub">{pct(r.margin)} do que recebi{r.noCostQty ? ` · ${r.noCostQty} sem valor pago` : ''}</small>
                    </>)}
                  </td>
                  <td className="num">{r.stock == null ? <span className="muted" title="Preencha o estoque no cadastro da peça para controlar">não controla</span> : <>{pcs(r.stock)}{r.stockValue != null && r.stock > 0 && <small className="sub">{brl(r.stockValue)}</small>}</>}</td>
                </tr>))}</tbody>
            </table></div>
          ) : <div className="empty">{q ? 'Nenhuma peça encontrada.' : `Nada comprado ou vendido ${label}.`}</div>}
        </>)}

        {tab === 'purchases' && (inPeriod.purchases.length ? (
          <div className="table-wrap"><table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Data</th><th>Peças</th><th className="num">Paguei</th><th /></tr></thead>
            <tbody>{inPeriod.purchases.map((pu) => {
              const items = pu.purchase_items || [];
              return (
                <tr key={pu.id} style={{ cursor: 'default' }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(pu.bought_on)}{pu.supplier && <small className="sub">{pu.supplier}</small>}</td>
                  <td>{items.map((i) => <div key={i.id}>{i.qty}× {i.name}{sizeText(i.size)} <span className="muted">a {brl(i.unit_cost)}</span></div>)}{pu.notes && <small className="sub">{pu.notes}</small>}</td>
                  <td className="num"><b>{brl(items.reduce((s, i) => s + Number(i.unit_cost) * i.qty, 0))}</b></td>
                  <td className="num"><button className="btn small danger" onClick={() => removePurchase(pu)} aria-label={`Excluir compra de ${fmtDay(pu.bought_on)}`}>Excluir</button></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">Nenhuma compra lançada {label}.<br /><button className="btn small solid" style={{ marginTop: 14 }} onClick={() => setDrawer('purchase')}>+ Lançar compra</button></div>)}

        {tab === 'sales' && (<>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>Vendas da loja, do WhatsApp e do crediário. As do site entram sozinhas no resumo.</p>
          {inPeriod.manual.length ? (
            <div className="table-wrap"><table className="t" style={{ minWidth: 680 }}>
              <thead><tr><th>Data</th><th>Peça</th><th>Onde</th><th className="num">Recebi</th><th className="num">Lucro</th><th /></tr></thead>
              <tbody>{inPeriod.manual.map((s) => (
                <tr key={s.id} style={{ cursor: 'default' }}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(s.sold_on)}</td>
                  <td>{s.qty}× {s.name}{sizeText(s.size)}{s.notes && <small className="sub">{s.notes}</small>}</td>
                  <td>{CHANNELS[s.channel]}</td>
                  <td className="num">{brl(s.unit_price * s.qty)}</td>
                  <td className="num">{s.unit_cost != null ? brl((s.unit_price - s.unit_cost) * s.qty) : <span className="muted">—</span>}</td>
                  <td className="num"><button className="btn small danger" onClick={() => removeManual(s)} aria-label={`Excluir venda de ${s.name} em ${fmtDay(s.sold_on)}`}>Excluir</button></td>
                </tr>))}</tbody>
            </table></div>
          ) : <div className="empty">Nenhuma venda fora do site {label}.<br /><button className="btn small solid" style={{ marginTop: 14 }} onClick={() => setDrawer('sale')}>+ Lançar venda</button></div>}
        </>)}

        <details className="howto">
          <summary>Como a conta é feita</summary>
          <ul>
            <li><b>Lucro</b> = o que recebi pelas peças vendidas − o que paguei por essas mesmas peças. Peça ainda no estoque não entra no lucro: aparece em “Ainda no estoque”.</li>
            <li>Vendas do site contam quando pagas (canceladas e reembolsadas ficam de fora). O valor recebido já desconta cupom e desconto PIX, sem o frete.</li>
            <li>O valor pago de cada venda é o da última compra lançada antes dela. As taxas do Mercado Pago não estão na conta.</li>
          </ul>
        </details>
      </>)}

      {drawer === 'purchase' && data && (
        <Drawer title="Lançar compra" subtitle="Peças compradas para revender. Elas entram no estoque." onClose={() => setDrawer(null)}>
          <NewPurchase products={data.products} onDone={done} />
        </Drawer>
      )}
      {drawer === 'sale' && data && (
        <Drawer title="Lançar venda" subtitle="Venda feita fora do site: loja, WhatsApp ou crediário. A peça sai do estoque." onClose={() => setDrawer(null)}>
          <ManualSale products={data.products} costs={data.costs} onDone={done} />
        </Drawer>
      )}
    </>
  );
}
