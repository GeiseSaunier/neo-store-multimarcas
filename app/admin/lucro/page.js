'use client';
// Custo e lucro, em duas abas:
// - Vendas e lucro: calculadora (quanto paguei × por quanto vendi, com o resultado na hora) que guarda
//   a venda, e o relatório do período (balanço, peça que mais e menos deu lucro, lista, PDF e planilha).
//   As vendas do site entram sozinhas.
// - Compras e estoque: compras de mercadoria, o resumo por peça e o que está parado no estoque.
// Contas: lib/lucro.js. Leitura e gravação no banco: lib/lucro-dados.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdmin } from '../_ctx';
import { brl } from '@/lib/format';
import { LEGAL, STORE } from '@/lib/config';
import { downloadCsv } from '@/lib/csv';
import { parseMoney, today, fmtDay } from '@/lib/crediario';
import { profitReport, CHANNELS, saleLines, salesSummary, salesCsv, pieceResult, pctText, moneyText, monthLabel, monthsOf, inPeriod, localDay } from '@/lib/lucro';
import { loadProfitData, addSale, deleteSale, addPurchase, deletePurchase, saveCost } from '@/lib/lucro-dados';

const OFF = '__fora__'; // peça fora do catálogo
const pcs = (n) => `${n} ${n === 1 ? 'peça' : 'peças'}`;
const controls = (p) => p && (p.stock != null || p.size_stock != null);
const sizeText = (s) => (s && s !== 'Único' ? ` (${s})` : '');
const TABS = [['sales', 'Vendas e lucro'], ['stock', 'Compras e estoque']];
// Para buscar sem diferença de maiúsculas e acentos ("blusa" acha "Blusa Média").
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

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

// Campo para digitar quanto pagou por uma peça do catálogo que ainda não tem esse valor.
function CostInput({ productId, onSaved }) {
  const { sb } = useAdmin();
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  async function save(e) {
    e.preventDefault();
    const c = parseMoney(v);
    if (!(c >= 0)) return setErr('Valor inválido');
    try { await saveCost(sb, productId, c); } catch (x) { return setErr(x.message); }
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

// Frase grande do resultado (de uma peça ou do balanço do período).
function ResultText({ kind, profit, pct: p, total }) {
  if (kind === 'zero') return <><b className="calc-big">Ficou no zero a zero</b><span>{total ? 'O que vendeu deu exatamente o que pagou' : 'Vendeu pelo mesmo valor que pagou'}</span></>;
  if (kind === 'prejuizo') return <><b className="calc-big">{total ? 'Prejuízo total de ' : 'Você teve prejuízo de '}{brl(-profit)}</b><span>Vendeu por menos do que pagou</span></>;
  return <><b className="calc-big">{total ? 'Lucro total de ' : 'Você lucrou '}{brl(profit)}</b>{p != null && <span>Ganhou {pctText(p)} em cima do que pagou</span>}</>;
}

// ---------- calculadora: mostra o lucro na hora e guarda a venda ----------
function Calculator({ products, costs, onSaved }) {
  const { sb } = useAdmin();
  const EMPTY = { name: '', size: '', cost: '', price: '' };
  const [f, setF] = useState(EMPTY);
  const [date, setDate] = useState(today);
  const [channel, setChannel] = useState('loja');
  const [bad, setBad] = useState({}); // campos de valor que não deu para entender
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Nome igual ao de uma peça do catálogo = é essa peça (sai do estoque e já traz os valores).
  // Sugestões de peças da loja enquanto digita (lista com o visual do painel).
  const catalog = useMemo(() => {
    const seen = new Map();
    for (const p of products) if (p.active && !seen.has(p.name)) seen.set(p.name, p);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1); // sugestão marcada pelas setas do teclado
  const suggestions = useMemo(() => {
    const n = norm(f.name);
    return n ? catalog.filter((p) => norm(p.name).includes(n) && norm(p.name) !== n).slice(0, 6) : [];
  }, [catalog, f.name]);
  const showList = open && suggestions.length > 0;
  function pick(p) {
    setF((s) => ({ ...s, name: p.name }));
    setOpen(false); setHi(-1);
    refs[1].current?.focus();
  }
  function onNameKey(e) {
    if (showList) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h <= 0 ? suggestions.length - 1 : h - 1)); return; }
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(suggestions[hi]); return; }
    }
    onKey(0)(e);
  }
  const match = useMemo(() => {
    const n = f.name.trim().toLowerCase();
    const all = n ? products.filter((p) => p.name.trim().toLowerCase() === n) : [];
    return all.find((p) => p.active) || all[0] || null;
  }, [f.name, products]);
  const sizes = match?.sizes?.length ? match.sizes : ['Único'];
  const needSize = !!match && sizes.length > 1;
  const lastMatch = useRef(null);
  useEffect(() => {
    const id = match?.id ?? null;
    if (id === lastMatch.current) return;
    lastMatch.current = id;
    if (!match) return setF((s) => ({ ...s, size: '' }));
    setF((s) => ({
      ...s, size: '',
      cost: s.cost || (costs[match.id] != null ? moneyText(costs[match.id]) : ''),
      price: s.price || moneyText(match.price),
    }));
  }, [match, costs]);

  const cost = parseMoney(f.cost), price = parseMoney(f.price);
  const hasValues = cost >= 0 && price >= 0;
  const ready = hasValues && !!date && (!needSize || !!f.size);
  const r = hasValues ? pieceResult(cost, price) : null;

  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.value })); setBad((b) => ({ ...b, [k]: false })); };
  // Ao sair do campo: "45.9" vira "45,90"; o que não for valor fica marcado.
  const tidy = (k) => () => {
    const v = parseMoney(f[k]);
    if (v >= 0) setF((s) => ({ ...s, [k]: moneyText(v) }));
    else setBad((b) => ({ ...b, [k]: f[k].trim() !== '' }));
  };
  function flash(ok, text, ms = 4000) {
    setMsg({ ok, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const res = await addSale(sb, {
        product_id: match?.id ?? null, name: match ? match.name : f.name.trim() || 'Peça sem nome', size: match ? f.size || sizes[0] : null,
        qty: 1, unit_price: price, unit_cost: cost, channel, sold_on: date, notes: null,
      });
      const noStock = match && controls(match) && res.stock_taken < 1;
      setF(EMPTY); setBad({});
      if (noStock) flash(true, 'Peça guardada no relatório. Atenção: ela já estava sem estoque na loja; confira o cadastro.', 9000);
      else flash(true, 'Peça guardada no relatório.');
      onSaved();
      refs[0].current?.focus();
    } catch (e) {
      flash(false, `${e.message} Confira a internet e tente de novo.`, 8000);
    }
    setBusy(false);
  }
  function clear() { setF(EMPTY); setDate(today()); setBad({}); setMsg(null); refs[0].current?.focus(); }

  // Enter passa para o próximo campo; no último, guarda a peça.
  const onKey = (i) => (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i < refs.length - 1) refs[i + 1].current?.focus();
    else save();
  };

  const nameHelp = match ? (controls(match) ? 'Peça do catálogo: ao guardar, sai 1 do estoque.' : 'Peça do catálogo.')
    : f.name.trim() ? 'Peça fora do catálogo: o estoque não muda.' : 'Comece a digitar para escolher uma peça da loja, ou escreva o nome.';

  return (
    <section className="card calc-card no-print" aria-labelledby="calc-t">
      <h2 id="calc-t">Calcular o lucro de uma peça</h2>
      <div className="calc-fields">
        <div className="field calc-wide">
          <label htmlFor="c-name">Nome da peça <span className="muted">(se quiser)</span></label>
          <div className="combo">
            <input id="c-name" ref={refs[0]} value={f.name} placeholder="Ex.: Vestido floral" maxLength={120} enterKeyHint="next" autoComplete="off"
              role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls="c-names" aria-activedescendant={showList && hi >= 0 ? `c-opt-${hi}` : undefined}
              onChange={(e) => { set('name')(e); setOpen(true); setHi(-1); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onNameKey} />
            {showList && (
              <ul id="c-names" role="listbox" className="combo-list" aria-label="Peças da loja">
                {suggestions.map((p, i) => (
                  <li key={p.id} id={`c-opt-${i}`} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''}
                    onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}>
                    <span>{p.name}</span><small>{brl(p.price)}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <span className="help">{nameHelp}</span>
        </div>
        {needSize && (
          <div className="field">
            <label htmlFor="c-size">Tamanho</label>
            <select id="c-size" value={f.size} onChange={set('size')}><option value="">Escolha…</option>{sizes.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </div>
        )}
        <div className="field">
          <label htmlFor="c-cost">Paguei (R$)</label>
          <input id="c-cost" ref={refs[1]} inputMode="decimal" value={f.cost} onChange={set('cost')} onBlur={tidy('cost')} onKeyDown={onKey(1)} placeholder="0,00" aria-invalid={bad.cost || undefined} enterKeyHint="next" />
          {bad.cost && <span className="err">Digite só o valor, ex.: 45,90</span>}
        </div>
        <div className="field">
          <label htmlFor="c-price">Vendi por (R$)</label>
          <input id="c-price" ref={refs[2]} inputMode="decimal" value={f.price} onChange={set('price')} onBlur={tidy('price')} onKeyDown={onKey(2)} placeholder="0,00" aria-invalid={bad.price || undefined} enterKeyHint="next" />
          {bad.price && <span className="err">Digite só o valor, ex.: 45,90</span>}
        </div>
        <div className="field">
          <label htmlFor="c-date">Data da venda</label>
          <input id="c-date" ref={refs[3]} type="date" value={date} onChange={(e) => setDate(e.target.value)} onKeyDown={onKey(3)} enterKeyHint="done" />
        </div>
        <div className="field">
          <label htmlFor="c-ch">Onde vendeu</label>
          <select id="c-ch" value={channel} onChange={(e) => setChannel(e.target.value)}>{['loja', 'whatsapp', 'crediario', 'outro'].map((c) => <option key={c} value={c}>{CHANNELS[c]}</option>)}</select>
        </div>
      </div>

      <div className={`calc-result ${r ? r.kind : 'wait'}`} aria-live="polite">
        {r ? <ResultText {...r} /> : <span>Preencha quanto pagou e por quanto vendeu para ver o lucro.</span>}
      </div>

      <div className="calc-actions">
        <button type="button" className="btn solid" onClick={save} disabled={!ready || busy}>{busy ? 'Guardando…' : 'Guardar no relatório'}</button>
        <button type="button" className="btn ghost" onClick={clear}>Limpar</button>
        {hasValues && needSize && !f.size && <span className="muted">Escolha o tamanho para guardar.</span>}
        <span role="status" className={msg?.ok ? 'okmsg' : 'err'}>{msg?.text}</span>
      </div>
    </section>
  );
}

// ---------- relatório de vendas do período ----------
function SalesReport({ lines, costs, period, periodText, onChanged }) {
  const { sb, ask } = useAdmin();
  const [err, setErr] = useState('');
  const s = useMemo(() => salesSummary(lines), [lines]);

  async function remove(l) {
    const ok = await ask({
      title: 'Apagar esta venda?',
      message: `${l.qty > 1 ? `${l.qty}× ` : ''}${l.name} · ${fmtDay(l.date)} · ${brl(l.price)}. ${l.stock_taken > 0 ? (l.stock_taken === 1 ? 'A peça volta' : `As ${l.stock_taken} peças voltam`) + ' para o estoque.' : 'Ela sai do relatório.'}`,
      confirmLabel: 'Apagar', danger: true,
    });
    if (!ok) return;
    setErr('');
    try { await deleteSale(sb, l.id); onChanged(); } catch (e) { setErr(`${e.message} Confira a internet e tente de novo.`); }
  }
  function exportCsv() {
    const { filename, header, rows } = salesCsv(lines, period);
    downloadCsv(filename, header, rows, { comma: true });
  }

  if (!lines.length) {
    return <div className="card empty">{period === 'all' ? 'Nenhuma peça no relatório ainda. Calcule uma peça acima e toque em “Guardar no relatório”. As vendas do site entram sozinhas.' : 'Nenhuma venda neste período.'}</div>;
  }

  return (
    <>
      <div className={`calc-balance ${s.lines ? s.kind : 'zero'}`}>
        <span className="lbl">Balanço · {periodText}</span>
        {s.lines ? <ResultText {...s} total /> : <b className="calc-big">Falta o valor pago das vendas</b>}
      </div>

      {s.missingQty > 0 && (
        <div className="alert warn">
          {pcs(s.missingQty)} {s.missingQty === 1 ? 'vendida está' : 'vendidas estão'} sem o valor que você pagou ({brl(s.missingPrice)} recebidos) e por isso {s.missingQty === 1 ? 'fica' : 'ficam'} fora do balanço. Digite quanto pagou na coluna “Paguei” da lista abaixo.
        </div>
      )}

      <div className="calc-kpis">
        <div className="kpi"><div className="lbl">Peças vendidas</div><div className="v">{s.count}</div></div>
        <div className="kpi"><div className="lbl">Total que paguei</div><div className="v">{brl(s.cost)}</div></div>
        <div className="kpi"><div className="lbl">Total que vendi</div><div className="v">{brl(s.price)}</div></div>
        <div className="kpi"><div className="lbl">Lucro médio por peça</div><div className={`v ${s.average < 0 ? 'neg' : ''}`}>{brl(s.average)}</div></div>
      </div>

      {s.best && (
        <div className="calc-kpis two">
          <div className="kpi"><div className="lbl">Peça que mais deu lucro</div><div className="v small">{s.best.name}</div><div className={`s ${s.best.profit < 0 ? 'down' : 'up'}`}>{s.best.profit < 0 ? `Prejuízo de ${brl(-s.best.profit)}` : `Lucro de ${brl(s.best.profit)}`} · {fmtDay(s.best.date)}</div></div>
          <div className="kpi"><div className="lbl">{s.worst.profit < 0 ? 'Peça que deu prejuízo' : 'Peça que menos deu lucro'}</div><div className="v small">{s.worst.name}</div><div className={`s ${s.worst.profit < 0 ? 'down' : ''}`}>{s.worst.profit < 0 ? `Prejuízo de ${brl(-s.worst.profit)}` : `Lucro de ${brl(s.worst.profit)}`} · {fmtDay(s.worst.date)}</div></div>
        </div>
      )}

      <div className="calc-actions no-print" style={{ marginBottom: 18 }}>
        <button type="button" className="btn ghost" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><path d="M7 14h10v7H7z" /></svg>Imprimir ou salvar em PDF
        </button>
        <button type="button" className="btn ghost" onClick={exportCsv}>
          <svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Baixar planilha
        </button>
      </div>

      {err && <p className="err no-print" role="alert">{err}</p>}
      <div className="table-wrap calc-table-wrap">
        <table className="t calc-table">
          <thead>
            <tr><th>Data</th><th>Peça</th><th>Onde</th><th className="num">Paguei</th><th className="num">Vendi</th><th className="num">Lucro</th><th className="no-print"><span className="sr-only">Apagar</span></th></tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const kind = l.profit == null ? '' : pieceResult(l.cost, l.price).kind;
              return (
                <tr key={l.key}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(l.date)}</td>
                  <td>{l.qty > 1 ? `${l.qty}× ` : ''}{l.name}{sizeText(l.size)}</td>
                  <td>{CHANNELS[l.channel] || l.channel}</td>
                  <td className="num">
                    {l.cost != null ? brl(l.cost)
                      : l.product_id && costs[l.product_id] == null ? <CostInput productId={l.product_id} onSaved={onChanged} />
                        : <span className="muted">falta</span>}
                  </td>
                  <td className="num">{brl(l.price)}</td>
                  <td className={`num profit ${kind}`}>{l.profit == null ? <span className="muted">—</span> : brl(l.profit)}</td>
                  <td className="no-print">{l.source === 'manual' && <button type="button" className="linkish" onClick={() => remove(l)}>Apagar</button>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td colSpan={2}>{pcs(s.count)}{s.missingQty ? ` (fora ${s.missingQty} sem valor pago)` : ''}</td>
              <td className="num">{brl(s.cost)}</td>
              <td className="num">{brl(s.price)}</td>
              <td className={`num profit ${s.kind}`}>{brl(s.profit)}</td>
              <td className="no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

// ---------- relatório para imprimir ou salvar em PDF ----------
// Só aparece na impressão (na tela fica escondido). Cabeçalho com a logo em todas as páginas,
// número da página no rodapé (@page em styles/lucro.css) e os dados da loja no fim.
function PrintReport({ lines, periodText }) {
  const s = salesSummary(lines);
  const now = new Date();
  const emitted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const dates = lines.map((l) => l.date).sort();
  const range = dates.length ? (dates[0] === dates.at(-1) ? `Vendas de ${fmtDay(dates[0])}` : `Vendas de ${fmtDay(dates[0])} a ${fmtDay(dates.at(-1))}`) : '';
  const insta = (LEGAL.instagram.match(/instagram\.com\/([^/?#]+)/) || [])[1];
  const byChannel = Object.entries(lines.reduce((m, l) => {
    const c = (m[l.channel] ||= { qty: 0, price: 0 });
    c.qty += l.qty; c.price += Math.round(l.price * 100);
    return m;
  }, {})).sort((a, b) => b[1].price - a[1].price);
  const head = { lucro: 'Lucro do período', prejuizo: 'Prejuízo do período', zero: 'Resultado do período' }[s.kind];
  const sub = s.kind === 'lucro' ? (s.pct != null ? `Ganhou ${pctText(s.pct)} em cima do que pagou` : '') : s.kind === 'prejuizo' ? 'Vendeu por menos do que pagou' : 'Ficou no zero a zero';
  const printRow = (l, i) => (
    <tr key={l.key} className={i % 2 ? 'z' : ''}>
      <td className="nowrap">{fmtDay(l.date)}</td>
      <td>{l.qty > 1 ? `${l.qty}× ` : ''}{l.name}{sizeText(l.size)}</td>
      <td>{CHANNELS[l.channel] || l.channel}</td>
      <td className="num">{l.cost == null ? '—' : brl(l.cost)}</td>
      <td className="num">{brl(l.price)}</td>
      <td className={`num ${l.profit == null ? '' : l.profit > 0 ? 'pos' : l.profit < 0 ? 'neg' : ''}`}>{l.profit == null ? '—' : brl(l.profit)}</td>
    </tr>
  );
  const pieceText = (l) => `${l.profit < 0 ? 'Prejuízo de ' + brl(-l.profit) : 'Lucro de ' + brl(l.profit)} · ${fmtDay(l.date)}`;

  return (
    <div className="rp" aria-hidden="true">
      <table className="rp-frame">
        <thead><tr><td>
          <header className="rp-head">
            <img src="/brand/word.png" alt="" className="rp-logo" />
            <div className="rp-head-r"><b>Relatório de vendas</b><span>{periodText}</span></div>
          </header>
        </td></tr></thead>
        <tbody><tr><td>
          <section className="rp-title">
            <div>
              <small>Relatório de vendas</small>
              <h1>{periodText}</h1>
              <p>{range ? `${range} · ${pcs(lines.reduce((n, l) => n + l.qty, 0))}` : 'Nenhuma venda neste período'}</p>
            </div>
            <dl className="rp-meta">
              <div><dt>Emitido em</dt><dd>{emitted}</dd></div>
              <div><dt>CNPJ</dt><dd>{LEGAL.cnpj}</dd></div>
            </dl>
          </section>

          {lines.length > 0 && (<>
            <section className={`rp-balance ${s.lines ? s.kind : 'zero'}`}>
              <div className="rp-main">
                <span>{s.lines ? head : 'Falta o valor pago das vendas'}</span>
                <b>{brl(Math.abs(s.profit))}</b>
                {sub && s.lines > 0 && <em>{sub}</em>}
              </div>
              <div className="rp-kpis">
                <div><span>Peças vendidas</span><b>{s.count}</b></div>
                <div><span>Lucro médio por peça</span><b className={s.average < 0 ? 'neg' : ''}>{brl(s.average)}</b></div>
                <div><span>Total que paguei</span><b>{brl(s.cost)}</b></div>
                <div><span>Total que vendi</span><b>{brl(s.price)}</b></div>
              </div>
            </section>

            {s.best && (
              <section className="rp-two">
                <div><span>Peça que mais deu lucro</span><b>{s.best.name}</b><em className={s.best.profit < 0 ? 'neg' : 'pos'}>{pieceText(s.best)}</em></div>
                <div><span>{s.worst.profit < 0 ? 'Peça que deu prejuízo' : 'Peça que menos deu lucro'}</span><b>{s.worst.name}</b><em className={s.worst.profit < 0 ? 'neg' : ''}>{pieceText(s.worst)}</em></div>
              </section>
            )}

            <section className="rp-channels">
              <span>Onde vendeu</span>
              {byChannel.map(([c, v]) => <div key={c}><b>{CHANNELS[c] || c}</b> {pcs(v.qty)} · {brl(v.price / 100)}</div>)}
            </section>

            {s.missingQty > 0 && (
              <p className="rp-warn">{pcs(s.missingQty)} {s.missingQty === 1 ? 'vendida está' : 'vendidas estão'} sem o valor pago ({brl(s.missingPrice)} recebidos) e {s.missingQty === 1 ? 'fica' : 'ficam'} fora do balanço e do total.</p>
            )}

            <h2 className="rp-h2">Vendas do período</h2>
            <table className="rp-table">
              <thead><tr><th>Data</th><th>Peça</th><th>Onde vendeu</th><th className="num">Paguei</th><th className="num">Vendi</th><th className="num">Lucro</th></tr></thead>
              <tbody>{lines.slice(0, -1).map(printRow)}</tbody>
              {/* a última venda fica junto do total (o total nunca vai sozinho para outra página) */}
              <tbody className="rp-keep">
                {printRow(lines.at(-1), lines.length - 1)}
                <tr className="rp-total">
                  <td colSpan={3}>Total · {pcs(s.count)}{s.missingQty ? ` (fora ${s.missingQty} sem valor pago)` : ''}</td>
                  <td className="num">{brl(s.cost)}</td>
                  <td className="num">{brl(s.price)}</td>
                  <td className={`num ${s.profit > 0 ? 'pos' : s.profit < 0 ? 'neg' : ''}`}>{brl(s.profit)}</td>
                </tr>
              </tbody>
            </table>
            <p className="rp-note">Lucro = por quanto vendeu − quanto pagou pela peça. Vendas do site entram quando pagas, já com cupom e desconto PIX, sem o frete.</p>
          </>)}

          <footer className="rp-end">
            <img src="/brand/mono.png" alt="" />
            <div>
              <b>{LEGAL.company}</b> · CNPJ {LEGAL.cnpj} · {LEGAL.cities}<br />
              WhatsApp {STORE.whatsappLabel}{insta ? ` · Instagram @${insta}` : ''}{LEGAL.email ? ` · ${LEGAL.email}` : ''}
            </div>
          </footer>
        </td></tr></tbody>
      </table>
    </div>
  );
}

// ---------- escolha da peça (compra) ----------
function PiecePicker({ products, value, onChange, idp }) {
  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const p = products.find((x) => x.id === value.product);
  const sizes = p?.sizes?.length ? p.sizes : ['Único'];
  return (
    <>
      <div className="field"><label htmlFor={`${idp}-p`}>Peça</label>
        <select id={`${idp}-p`} value={value.product} onChange={(e) => {
          const np = products.find((x) => x.id === e.target.value);
          onChange({ product: e.target.value, name: '', size: np?.sizes?.length > 1 ? '' : np?.sizes?.[0] || '' });
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
    try {
      await addPurchase(sb, { supplier: head.supplier.trim(), bought_on: head.bought_on, notes: head.notes.trim() || null }, items);
    } catch (x) { setBusy(false); return setErr(x.message); }
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

// ---------- aba Compras e estoque ----------
function StockTab({ data, filtered, label, onBuy, onChanged, setNotice }) {
  const { sb, ask } = useAdmin();
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const report = useMemo(() => profitReport(filtered), [filtered]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return report.rows.filter((r) => !t || r.name.toLowerCase().includes(t));
  }, [report, q]);
  const t = report.totals;

  async function removePurchase(pu) {
    const back = (pu.purchase_items || []).reduce((s, i) => s + i.stock_added, 0);
    if (!(await ask({ title: `Excluir a compra de ${fmtDay(pu.bought_on)}${pu.supplier ? ` (${pu.supplier})` : ''}?`, message: `${back ? `${pcs(back)} ${back === 1 ? 'sai' : 'saem'} do estoque (sem ficar negativo, se já vendeu). ` : ''}O valor pago das peças continua o mesmo no cadastro.`, confirmLabel: 'Excluir compra', danger: true }))) return;
    setErr('');
    try { await deletePurchase(sb, pu.id); setNotice('Compra excluída.'); onChanged(); } catch (e) { setErr(e.message); }
  }
  function exportCsv() {
    downloadCsv(`custo-e-lucro-estoque-${today()}.csv`,
      ['Item', 'Comprei (peças)', 'Paguei (R$)', 'Vendi (peças)', 'Recebi (R$)', 'Onde vendeu', 'Custo do que vendi', 'Lucro', 'Ainda no estoque', 'Valor no estoque', 'Vendidas sem custo'],
      rows.map((r) => [r.name, r.boughtQty, r.boughtCost, r.qty, r.revenue, channelsText(r.byChannel), r.cost, r.profit, r.stock ?? '', r.stockValue ?? '', r.noCostQty || '']));
  }

  if (!data.purchases.length && !report.rows.length) {
    return (
      <div className="card start">
        <h2>Comece por aqui</h2>
        <ol>
          <li><b>Lance as compras</b> de mercadoria: qual peça, quantas e quanto pagou em cada. Elas entram no estoque.</li>
          <li>Aqui aparece, para cada peça, <b>quanto comprou, quanto vendeu e o que ainda está no estoque</b>.</li>
        </ol>
        <button className="btn solid" onClick={onBuy}>+ Lançar a primeira compra</button>
      </div>
    );
  }

  return (
    <>
      <div className="calc-actions" style={{ marginBottom: 18 }}>
        <button className="btn solid" onClick={onBuy}>+ Lançar compra</button>
      </div>
      {err && <div className="alert">{err}</div>}

      <div className="calc-kpis two">
        <div className="kpi"><div className="lbl">Paguei nas compras</div><div className="v">{brl(t.boughtCost)}</div><div className="s">{pcs(t.boughtQty)} compradas {label}</div></div>
        <div className="kpi"><div className="lbl">Ainda no estoque</div><div className="v">{brl(t.stockValue)}</div><div className="s">{pcs(t.stock)} esperando venda</div></div>
      </div>

      <h2 className="calc-sub">Peça por peça</h2>
      <div className="list-tools">
        <input className="input" placeholder="Buscar peça" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn small ghost" onClick={exportCsv} disabled={!rows.length}>Baixar planilha</button>
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
                  r.product_id && data.costs[r.product_id] == null ? <CostInput productId={r.product_id} onSaved={() => { setNotice(`Valor pago de ${r.name} salvo.`); onChanged(); }} /> : <span className="muted">falta o valor pago</span>
                ) : (<>
                  <b style={{ color: r.profit < 0 ? 'var(--bad)' : 'var(--ok)' }}>{brl(r.profit)}</b>
                  {r.noCostQty > 0 && <small className="sub">{r.noCostQty} sem valor pago</small>}
                </>)}
              </td>
              <td className="num">{r.stock == null ? <span className="muted" title="Preencha o estoque no cadastro da peça para controlar">não controla</span> : <>{pcs(r.stock)}{r.stockValue != null && r.stock > 0 && <small className="sub">{brl(r.stockValue)}</small>}</>}</td>
            </tr>))}</tbody>
        </table></div>
      ) : <div className="empty">{q ? 'Nenhuma peça encontrada.' : `Nada comprado ou vendido ${label}.`}</div>}

      <h2 className="calc-sub">Compras</h2>
      {filtered.purchases.length ? (
        <div className="table-wrap"><table className="t" style={{ minWidth: 640 }}>
          <thead><tr><th>Data</th><th>Peças</th><th className="num">Paguei</th><th /></tr></thead>
          <tbody>{filtered.purchases.map((pu) => {
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
      ) : <div className="empty">Nenhuma compra lançada {label}.</div>}
    </>
  );
}

// ---------- página ----------
export default function Lucro() {
  const { sb } = useAdmin();
  const [tab, setTab] = useState('sales');
  const [period, setPeriod] = useState('all');
  const [drawer, setDrawer] = useState(false); // gaveta de lançar compra
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setData(await loadProfitData(sb)); setErr(''); } catch (e) { setErr(e.message); }
  }, [sb]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 8000); return () => clearTimeout(t); }, [notice]);

  const lines = useMemo(() => (data ? saleLines(data) : []), [data]);
  const months = useMemo(() => (data ? monthsOf([...lines.map((l) => l.date), ...data.purchases.map((p) => p.bought_on)]) : []), [data, lines]);
  // Se o mês escolhido ficou sem nada (tudo apagado), volta para todos os meses.
  useEffect(() => { if (data && period !== 'all' && !months.includes(period)) setPeriod('all'); }, [data, months, period]);

  // Período: compras pela data da compra, vendas do site pela data do pagamento, as lançadas pela data da venda.
  const periodLines = useMemo(() => lines.filter((l) => inPeriod(l.date, period)), [lines, period]);
  const filtered = useMemo(() => data && ({
    ...data,
    orders: data.orders.filter((o) => inPeriod(localDay(o.paid_at || o.created_at), period)),
    manual: data.manual.filter((s) => inPeriod(s.sold_on, period)),
    purchases: data.purchases.filter((pu) => inPeriod(pu.bought_on, period)),
  }), [data, period]);
  const periodText = period === 'all' ? 'Todos os meses' : monthLabel(period);
  const label = period === 'all' ? 'até agora' : `em ${monthLabel(period).toLowerCase()}`;

  return (
    <div className="calc">
      <div className="no-print">
      <div className="page-head">
        <div><h1>Custo e lucro</h1><p>Quanto você pagou pelas peças, por quanto vendeu e quanto sobrou de lucro.</p></div>
      </div>

      {notice && <div className="notice no-print" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
      {err && <div className="alert no-print">{err} <button className="linkish" onClick={load}>Tentar de novo</button></div>}

      {!data ? (!err && <div className="empty"><span className="mono" />Carregando…</div>) : (<>
        <div className="calc-bar no-print">
          <div className="seg calc-tabs" role="tablist" aria-label="O que ver">
            {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          <div className="field calc-period">
            <label htmlFor="c-period">Período</label>
            <select id="c-period" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">Todos os meses</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
        </div>

        {tab === 'sales' ? (<>
          <Calculator products={data.products} costs={data.costs} onSaved={load} />
          <h2 className="calc-sub no-print">Relatório de vendas · {periodText}</h2>
          <SalesReport lines={periodLines} costs={data.costs} period={period} periodText={periodText} onChanged={load} />
        </>) : (
          <StockTab data={data} filtered={filtered} label={label} onBuy={() => setDrawer(true)} onChanged={load} setNotice={setNotice} />
        )}

        <details className="howto no-print">
          <summary>Como a conta é feita</summary>
          <ul>
            <li><b>Lucro</b> = por quanto vendeu − quanto pagou pela peça. A porcentagem é o quanto ganhou <b>em cima do que pagou</b> (pagou 50 e vendeu 80: 60%).</li>
            <li>As vendas do site entram sozinhas quando são pagas (canceladas e reembolsadas ficam de fora). O valor já desconta cupom e desconto PIX, sem o frete.</li>
            <li>Ao guardar uma peça do catálogo, ela sai do estoque. Peça fora do catálogo não mexe no estoque.</li>
            <li>O valor pago de cada venda do site é o da última compra lançada antes dela. As taxas do Mercado Pago não estão na conta.</li>
          </ul>
        </details>
      </>)}
      </div>

      {data && <PrintReport lines={periodLines} periodText={periodText} />}

      {drawer && data && (
        <Drawer title="Lançar compra" subtitle="Peças compradas para revender. Elas entram no estoque." onClose={() => setDrawer(false)}>
          <NewPurchase products={data.products} onDone={(m) => { setDrawer(false); setNotice(m); load(); }} />
        </Drawer>
      )}
    </div>
  );
}
