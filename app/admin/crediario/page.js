'use client';
// Crediário: vendas a prazo, quanto cada cliente já pagou e quanto falta.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../_ctx';
import { brl, onlyDigits } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { parseMoney, today, fmtDay, saleSummary, receivedInMonth, creditError } from '@/lib/crediario';

const FILTERS = [['open', 'Em aberto'], ['settled', 'Quitadas'], ['all', 'Todas']];
const EMPTY = { customer_name: '', phone: '', description: '', total: '', sold_on: '', down: '' };

function exportSales(list) {
  downloadCsv(`crediario-neo-store-${today()}.csv`,
    ['Cliente', 'Telefone', 'Compra', 'Data da venda', 'Total', 'Pago', 'Falta', 'Último pagamento', 'Situação', 'Pagamentos'],
    list.map(({ s, sum }) => [s.customer_name, s.phone, s.description, fmtDay(s.sold_on), sum.total, sum.paid, sum.left, sum.last ? fmtDay(sum.last.paid_on) : '', sum.settled ? 'Quitada' : 'Em aberto',
      sum.history.map((p) => `${fmtDay(p.paid_on)}: ${brl(p.amount)}`).join(' | ')]));
}

function NewSale({ onCreated }) {
  const { sb } = useAdmin();
  const [f, setF] = useState(() => ({ ...EMPTY, sold_on: today() }));
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function add(e) {
    e.preventDefault(); setMsg('');
    const total = parseMoney(f.total), down = f.down.trim() ? parseMoney(f.down) : 0;
    if (!f.customer_name.trim()) return setMsg('Digite o nome da cliente.');
    if (!(total > 0)) return setMsg('Digite o valor total da venda, ex.: 450,00.');
    if (!(down >= 0)) return setMsg('A entrada precisa ser um valor, ex.: 100,00.');
    if (down > total) return setMsg('A entrada não pode passar do valor total.');
    if (!f.sold_on) return setMsg('Escolha a data da venda.');
    setBusy(true);
    const { data, error } = await sb.from('credit_sales').insert({
      customer_name: f.customer_name.trim(), phone: onlyDigits(f.phone) || null, description: f.description.trim(), total, sold_on: f.sold_on,
    }).select('id').single();
    if (error) { setBusy(false); return setMsg('Não foi possível salvar a venda.'); }
    if (down > 0) {
      const r = await sb.from('credit_payments').insert({ sale_id: data.id, amount: down, paid_on: f.sold_on, note: 'Entrada' });
      if (r.error) { setBusy(false); setMsg('A venda foi salva, mas a entrada não. Abra a venda e lance a entrada.'); onCreated(); return; }
    }
    setBusy(false); setF({ ...EMPTY, sold_on: today() }); onCreated(data.id);
  }

  return (
    <form onSubmit={add} className="card" style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>Nova venda a prazo</h2>
      <div className="row">
        <div className="field"><label htmlFor="cn">Cliente</label><input id="cn" value={f.customer_name} onChange={set('customer_name')} placeholder="Nome da cliente" /></div>
        <div className="field"><label htmlFor="cf">WhatsApp (opcional)</label><input id="cf" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="(92) 99999-9999" /></div>
        <div className="field"><label htmlFor="cd">O que levou (opcional)</label><input id="cd" value={f.description} onChange={set('description')} placeholder="Ex.: Bolsa Monograma" /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="ct">Valor total (R$)</label><input id="ct" inputMode="decimal" value={f.total} onChange={set('total')} placeholder="0,00" /></div>
        <div className="field"><label htmlFor="ce">Entrada (R$, opcional)</label><input id="ce" inputMode="decimal" value={f.down} onChange={set('down')} placeholder="0,00" /><span className="help">Fica no histórico como o primeiro pagamento.</span></div>
        <div className="field"><label htmlFor="cs">Data da venda</label><input id="cs" type="date" value={f.sold_on} onChange={set('sold_on')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn solid" disabled={busy}>{busy ? 'Salvando…' : 'Salvar venda'}</button>
        {msg && <span className="err">{msg}</span>}
      </div>
    </form>
  );
}

function SaleDetail({ sale, onClose, onChanged }) {
  const { sb, ask } = useAdmin();
  const sum = saleSummary(sale);
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(today());
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(sale.notes || '');
  const [msg, setMsg] = useState({ t: '', ok: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNotes(sale.notes || ''); setMsg({ t: '' }); setAmount(''); setNote(''); }, [sale.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  async function pay(e) {
    e.preventDefault();
    const v = parseMoney(amount);
    if (!(v > 0)) return setMsg({ t: 'Digite o valor pago, ex.: 50,00.' });
    if (v > sum.left) return setMsg({ t: `O valor passa do que falta (${brl(sum.left)}).` });
    if (!day) return setMsg({ t: 'Escolha a data do pagamento.' });
    setBusy(true);
    const { error } = await sb.from('credit_payments').insert({ sale_id: sale.id, amount: v, paid_on: day, note: note.trim() || null });
    setBusy(false);
    if (error) return setMsg({ t: creditError(error, 'Não foi possível lançar o pagamento.') });
    const left = Math.round((sum.left - v) * 100) / 100;
    setMsg({ t: left > 0 ? `Pagamento de ${brl(v)} lançado. Faltam ${brl(left)}.` : `Pagamento de ${brl(v)} lançado. Venda quitada!`, ok: true });
    setAmount(''); setNote(''); onChanged();
  }
  async function removePay(p) {
    if (!(await ask({ title: `Excluir o pagamento de ${brl(p.amount)}?`, message: `Lançado em ${fmtDay(p.paid_on)}. O valor volta para o que falta pagar.`, confirmLabel: 'Excluir pagamento', danger: true }))) return;
    const { error } = await sb.from('credit_payments').delete().eq('id', p.id);
    setMsg(error ? { t: 'Não foi possível excluir o pagamento.' } : { t: 'Pagamento excluído.', ok: true }); onChanged();
  }
  async function saveNotes() {
    const { error } = await sb.from('credit_sales').update({ notes: notes.trim() || null }).eq('id', sale.id);
    setMsg(error ? { t: 'Não foi possível salvar a observação.' } : { t: 'Observação salva.', ok: true }); if (!error) onChanged();
  }
  async function removeSale() {
    if (!(await ask({ title: `Excluir a venda de ${sale.customer_name}?`, message: 'A venda e todos os pagamentos dela somem do crediário. Isso não pode ser desfeito.', confirmLabel: 'Excluir venda', danger: true }))) return;
    const { error } = await sb.from('credit_sales').delete().eq('id', sale.id);
    if (error) return setMsg({ t: 'Não foi possível excluir a venda.' });
    onChanged(); onClose();
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setMsg({ t: 'Link do extrato copiado.', ok: true }); }
    catch { setMsg({ t: `Não deu para copiar. O link é: ${link}` }); }
  }
  async function newLink() {
    if (!(await ask({ title: 'Trocar o link do extrato?', message: 'O link antigo para de funcionar. Use se ele foi parar com outra pessoa. Depois, mande o link novo para a cliente.', confirmLabel: 'Trocar link' }))) return;
    const { error } = await sb.from('credit_sales').update({ public_token: crypto.randomUUID() }).eq('id', sale.id);
    setMsg(error ? { t: 'Não foi possível trocar o link.' } : { t: 'Link trocado. O antigo não abre mais.', ok: true }); if (!error) onChanged();
  }

  const phone = onlyDigits(sale.phone || '');
  const first = sale.customer_name.trim().split(/\s+/)[0];
  const link = `${typeof window === 'undefined' ? '' : window.location.origin}/crediario/${sale.public_token}`;
  const waText = sum.settled
    ? `Oi, ${first}! Tudo bem? Segue o extrato da sua compra na Neo Store${sale.description ? ` (${sale.description})` : ''}, já quitada. Obrigada! 💛\n${link}`
    : `Oi, ${first}! Tudo bem? Segue o extrato da sua compra na Neo Store${sale.description ? ` (${sale.description})` : ''}: lá aparecem todos os pagamentos e o saldo de ${brl(sum.left)}. Qualquer dúvida, é só chamar 💛\n${link}`;
  const wa = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(waText)}` : null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Venda de ${sale.customer_name}`}>
        <div className="head">
          <div>
            <h2>{sale.customer_name}</h2>
            <p className="muted" style={{ margin: '8px 0 0' }}>{sale.description || 'Venda a prazo'} · {fmtDay(sale.sold_on)}</p>
          </div>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="body">
          <section>
            <div className="sum">
              <div><span>Valor da venda</span><span>{brl(sum.total)}</span></div>
              <div><span>Já pagou</span><span>{brl(sum.paid)}</span></div>
              <div className="tot"><span>{sum.settled ? 'Situação' : 'Falta pagar'}</span><span>{sum.settled ? <span className="badge ok">Quitada</span> : brl(sum.left)}</span></div>
            </div>
            <div className="actions" style={{ marginTop: 14 }}>
              {wa && <a className="btn small solid" href={wa} target="_blank" rel="noopener">Enviar extrato pelo WhatsApp</a>}
              <button className="btn small ghost" onClick={copyLink}>Copiar link do extrato</button>
              <a className="btn small ghost" href={link} target="_blank" rel="noopener">Ver como a cliente vê</a>
              {phone && <a className="btn small ghost" href={`tel:+55${phone}`}>Ligar</a>}
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
              A cliente vê só o primeiro nome, a compra, os valores e as datas dos pagamentos. {' '}
              <button onClick={newLink} style={{ textDecoration: 'underline', fontSize: 12 }}>Trocar link</button>
            </p>
          </section>

          {!sum.settled && (
            <section>
              <h3>Lançar pagamento</h3>
              <form onSubmit={pay} style={{ display: 'grid', gap: 12 }}>
                <div className="row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))' }}>
                  <div className="field"><label htmlFor="pv">Valor pago (R$)</label><input id="pv" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
                  <div className="field"><label htmlFor="pd">Data</label><input id="pd" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>
                </div>
                <div className="field"><label htmlFor="pn">Observação (opcional)</label><input id="pn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: PIX, dinheiro" /></div>
                <div className="actions">
                  <button className="btn small solid" disabled={busy}>{busy ? 'Lançando…' : 'Lançar pagamento'}</button>
                  <button type="button" className="btn small ghost" onClick={() => setAmount(sum.left.toFixed(2).replace('.', ','))}>Pagou tudo ({brl(sum.left)})</button>
                </div>
              </form>
            </section>
          )}
          {msg.t && <span className={msg.ok ? 'okmsg' : 'err'} role="status">{msg.t}</span>}

          <section>
            <h3>Pagamentos</h3>
            {sum.history.length ? (
              <div>
                {[...sum.history].reverse().map((p) => (
                  <div key={p.id} className="pay-line">
                    <div>
                      <b>Pagou {brl(p.amount)}</b> em {fmtDay(p.paid_on)}{p.note ? <span className="muted"> · {p.note}</span> : null}
                      <small>{p.left > 0 ? `Depois deste pagamento faltavam ${brl(p.left)}` : 'Quitou a venda'}</small>
                    </div>
                    <button className="btn small danger" onClick={() => removePay(p)} aria-label={`Excluir pagamento de ${brl(p.amount)} em ${fmtDay(p.paid_on)}`}>Excluir</button>
                  </div>
                ))}
              </div>
            ) : <p className="muted" style={{ margin: 0 }}>Nenhum pagamento ainda.</p>}
          </section>

          <section>
            <h3>Dados da venda</h3>
            <div className="kv">
              <span>Data da venda</span><span>{fmtDay(sale.sold_on)}</span>
              {sale.phone && <><span>WhatsApp</span><span>{sale.phone}</span></>}
              {sale.description && <><span>Compra</span><span>{sale.description}</span></>}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="sn">Observação</label>
              <textarea id="sn" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: combinou de pagar todo dia 10" style={{ minHeight: 70 }} />
            </div>
            <div className="actions" style={{ marginTop: 10 }}>
              <button className="btn small ghost" onClick={saveNotes} disabled={notes === (sale.notes || '')}>Salvar observação</button>
              <button className="btn small danger" onClick={removeSale} style={{ marginLeft: 'auto' }}>Excluir venda</button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

export default function Crediario() {
  const { sb } = useAdmin();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await sb.from('credit_sales').select('*, credit_payments(*)').order('sold_on', { ascending: false }).order('created_at', { ascending: false });
    if (error) { setError('Não foi possível carregar o crediário. Confira se o banco foi atualizado com o supabase/schema.sql.'); setRows([]); return; }
    setError(''); setRows(data || []);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => (rows || []).map((s) => ({ s, sum: saleSummary(s) })), [rows]);
  const stats = useMemo(() => {
    const open = all.filter((x) => !x.sum.settled);
    return {
      toReceive: open.reduce((a, x) => a + Math.round(x.sum.left * 100), 0) / 100,
      month: receivedInMonth(rows || [], today()),
      people: new Set(open.map((x) => x.s.customer_name.trim().toLowerCase())).size,
      counts: { open: open.length, settled: all.length - open.length, all: all.length },
    };
  }, [all, rows]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase(), d = onlyDigits(q);
    return all.filter(({ s, sum }) => (filter === 'all' || (filter === 'open' ? !sum.settled : sum.settled)) &&
      (!t || s.customer_name.toLowerCase().includes(t) || (s.description || '').toLowerCase().includes(t) || (d && (s.phone || '').includes(d))));
  }, [all, filter, q]);
  const open = rows?.find((s) => s.id === openId);
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <>
      <div className="page-head">
        <div><h1>Crediário</h1><p>Vendas a prazo: quanto cada cliente já pagou e quanto falta.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Buscar por cliente, compra ou telefone" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280, maxWidth: '100%' }} />
          <button className="btn ghost" onClick={() => exportSales(list)} disabled={!list.length}>Exportar planilha</button>
        </div>
      </div>

      <div className="kpis credit-kpis">
        <div className="kpi"><div className="lbl">A receber</div><div className="v">{brl(stats.toReceive)}</div><div className="s">em {stats.counts.open} {stats.counts.open === 1 ? 'venda' : 'vendas'}</div></div>
        <div className="kpi"><div className="lbl">Recebido em {monthName}</div><div className="v">{brl(stats.month)}</div><div className="s">pagamentos lançados no mês</div></div>
        <div className="kpi"><div className="lbl">Clientes devendo</div><div className="v">{stats.people}</div><div className="s">com saldo em aberto</div></div>
      </div>

      <NewSale onCreated={(id) => { load(); if (id) setOpenId(id); }} />

      <div className="seg" role="group" aria-label="Filtrar vendas" style={{ marginBottom: 18 }}>
        {FILTERS.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span className="n">{stats.counts[k]}</span></button>)}
      </div>

      {error && <div className="alert">{error}</div>}
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : list.length ? (
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Cliente</th><th>Compra</th><th>Venda</th><th className="num">Total</th><th className="num">Pago</th><th className="num">Falta</th><th>Último pagamento</th><th>Situação</th></tr></thead>
          <tbody>{list.map(({ s, sum }) => (
            <tr key={s.id} onClick={() => setOpenId(s.id)} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenId(s.id))}>
              <td><b style={{ fontWeight: 500 }}>{s.customer_name}</b></td>
              <td className="muted">{s.description || '—'}</td>
              <td>{fmtDay(s.sold_on)}</td>
              <td className="num">{brl(sum.total)}</td>
              <td className="num">{brl(sum.paid)}</td>
              <td className="num" style={{ fontWeight: 600, color: sum.settled ? 'var(--muted)' : 'var(--ink)' }}>{brl(sum.left)}</td>
              <td>{sum.last ? `${brl(sum.last.amount)} em ${fmtDay(sum.last.paid_on)}` : <span className="muted">Nenhum</span>}</td>
              <td>{sum.settled ? <span className="badge ok">Quitada</span> : sum.paid > 0 ? <span className="badge wait">Pagando</span> : <span className="badge bad">Sem pagamento</span>}</td>
            </tr>))}</tbody>
        </table></div>
      ) : <div className="empty">{q ? 'Nenhuma venda encontrada para essa busca.' : filter === 'open' ? 'Nenhuma venda em aberto. Tudo recebido!' : 'Nenhuma venda a prazo cadastrada ainda.'}</div>}

      {open && <SaleDetail sale={open} onClose={() => setOpenId(null)} onChanged={load} />}
    </>
  );
}
