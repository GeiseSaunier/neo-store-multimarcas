'use client';
// Promoções: desconto em % nas peças escolhidas, com data e hora de início e fim.
// A loja aplica o desconto sozinha no período (lib/promo.js) e mostra a faixa na página inicial.
import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../_ctx';
import { brl, fmtDateTime } from '@/lib/format';
import { BRANDS, brandName } from '@/lib/config';
import { promoStatus, promoPrice } from '@/lib/promo';

const STATUS_UI = {
  active: { label: 'Ativa', tone: 'ok' },
  scheduled: { label: 'Agendada', tone: 'info' },
  paused: { label: 'Pausada', tone: 'wait' },
  ended: { label: 'Encerrada', tone: 'done' },
};
// <input type="datetime-local"> trabalha no horário do computador; o banco guarda em UTC.
const toInput = (iso) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const fromInput = (v) => new Date(v).toISOString();
function blank() {
  const start = new Date(); start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 7 * 864e5); end.setHours(23, 59, 0, 0);
  return { name: '', percent: '10', starts_at: toInput(start), ends_at: toInput(end), active: true, product_ids: [] };
}

function Editor({ promo, products, onClose, onSaved }) {
  const { sb } = useAdmin();
  const [f, setF] = useState(promo.id ? { ...promo, percent: String(Number(promo.percent)), starts_at: toInput(promo.starts_at), ends_at: toInput(promo.ends_at) } : blank());
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // mexeu em algum campo: some a mensagem de erro antiga
  const upd = (patch) => { setF((s) => ({ ...s, ...patch })); setMsg(''); };
  const pct = Number(String(f.percent).replace(',', '.'));
  const chosen = new Set(f.product_ids);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => (brand === 'all' || p.brand === brand) && (!t || p.name.toLowerCase().includes(t)));
  }, [products, q, brand]);
  const toggle = (id) => { setMsg(''); setF((s) => ({ ...s, product_ids: s.product_ids.includes(id) ? s.product_ids.filter((x) => x !== id) : [...s.product_ids, id] })); };
  const allShown = list.length > 0 && list.every((p) => chosen.has(p.id));
  const toggleShown = () => setF((s) => {
    const ids = new Set(s.product_ids);
    list.forEach((p) => (allShown ? ids.delete(p.id) : ids.add(p.id)));
    return { ...s, product_ids: [...ids] };
  });

  async function save(e) {
    e.preventDefault(); setMsg('');
    if (!f.name.trim()) return setMsg('Dê um nome para a promoção (ex.: Black Friday).');
    if (!(pct > 0 && pct < 100)) return setMsg('O desconto precisa ficar entre 1% e 99%.');
    if (!f.starts_at || !f.ends_at) return setMsg('Informe a data e a hora de início e de fim.');
    if (new Date(f.ends_at) <= new Date(f.starts_at)) return setMsg('O fim precisa ser depois do início.');
    if (!promo.id && new Date(f.ends_at) <= new Date()) return setMsg('A data de fim já passou. Escolha uma data futura.');
    if (!f.product_ids.length) return setMsg('Escolha pelo menos uma peça.');
    setBusy(true);
    const row = { name: f.name.trim(), percent: pct, starts_at: fromInput(f.starts_at), ends_at: fromInput(f.ends_at), active: f.active, product_ids: f.product_ids };
    const { error } = promo.id ? await sb.from('promotions').update(row).eq('id', promo.id) : await sb.from('promotions').insert(row);
    setBusy(false);
    if (error) return setMsg('Não foi possível salvar a promoção. Tente de novo.');
    onSaved();
  }

  return (
    <form onSubmit={save} className="card" style={{ display: 'grid', gap: 16, marginBottom: 22 }}>
      <h2 style={{ margin: 0 }}>{promo.id ? 'Editar promoção' : 'Nova promoção'}</h2>
      <div className="row">
        <div className="field"><label htmlFor="pn">Nome</label><input id="pn" value={f.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Ex.: Black Friday" /><span className="help">Aparece para a cliente na faixa da página inicial.</span></div>
        <div className="field" style={{ maxWidth: 160 }}><label htmlFor="pp">Desconto (%)</label><input id="pp" inputMode="decimal" value={f.percent} onChange={(e) => upd({ percent: e.target.value })} /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="ps">Começa em</label><input id="ps" type="datetime-local" value={f.starts_at} onChange={(e) => upd({ starts_at: e.target.value })} /></div>
        <div className="field"><label htmlFor="pe">Termina em</label><input id="pe" type="datetime-local" value={f.ends_at} onChange={(e) => upd({ ends_at: e.target.value })} /><span className="help">Na data e hora de fim, as peças voltam sozinhas ao preço normal.</span></div>
      </div>
      <label className="switch"><input type="checkbox" checked={f.active} onChange={(e) => upd({ active: e.target.checked })} />Promoção ligada (desligue para pausar sem apagar)</label>

      <div className="field">
        <label>Peças na promoção ({f.product_ids.length})</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" placeholder="Buscar peça" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <div className="seg" role="group" aria-label="Filtrar por marca">
            <button type="button" aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>Todas</button>
            {Object.entries(BRANDS).map(([k, b]) => <button type="button" key={k} aria-pressed={brand === k} onClick={() => setBrand(k)}>{b.name}</button>)}
          </div>
          <button type="button" className="btn small ghost" onClick={toggleShown} disabled={!list.length}>{allShown ? 'Desmarcar as mostradas' : 'Marcar todas as mostradas'}</button>
        </div>
        <div className="promo-pick">
          {list.map((p) => (
            <label key={p.id} className={`promo-opt ${chosen.has(p.id) ? 'on' : ''} ${p.active ? '' : 'off'}`}>
              <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} />
              {p.images?.[0] ? <img src={p.images[0]} alt="" /> : <span className="ph" />}
              <span><b>{p.name}</b><small>{brandName(p.brand, p.brand_label)}{p.active ? '' : ' · oculta na loja'}</small>
                <small>{brl(p.price)}{pct > 0 && pct < 100 ? <> → <b>{brl(promoPrice(p.price, pct))}</b></> : null}</small></span>
            </label>
          ))}
          {!list.length && <p className="muted">Nenhuma peça encontrada.</p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {msg && <span className="err" role="alert">{msg}</span>}
        <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn solid" disabled={busy}>{busy ? 'Salvando…' : promo.id ? 'Salvar alterações' : 'Criar promoção'}</button>
      </div>
    </form>
  );
}

export default function Promotions() {
  const { sb, ask } = useAdmin();
  const [rows, setRows] = useState(null);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // {} = nova; objeto = editar
  const [msg, setMsg] = useState('');
  const [, tick] = useState(0);

  const load = () => sb.from('promotions').select('*').order('ends_at', { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => {
    load();
    sb.from('products').select('id,name,brand,brand_label,price,images,active').order('position').then(({ data }) => setProducts(data || []));
    const t = setInterval(() => tick((n) => n + 1), 60e3); // atualiza "Ativa/Encerrada" sem recarregar
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(p, changes, ok) {
    setMsg('');
    const { error } = await sb.from('promotions').update(changes).eq('id', p.id);
    setMsg(error ? 'Não foi possível atualizar a promoção.' : ok);
    load();
  }
  const endNow = async (p) => { if (await ask({ title: `Encerrar “${p.name}” agora?`, message: 'As peças voltam ao preço normal na hora.', confirmLabel: 'Encerrar promoção', danger: true })) update(p, { ends_at: new Date().toISOString() }, 'Promoção encerrada.'); };
  const remove = async (p) => { if (!(await ask({ title: `Excluir a promoção “${p.name}”?`, message: 'Ela some da lista. Se ainda estiver valendo, as peças voltam ao preço normal na hora.', confirmLabel: 'Excluir promoção', danger: true }))) return; await sb.from('promotions').delete().eq('id', p.id); load(); };
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <>
      <div className="page-head">
        <div><h1>Promoções</h1><p>Desconto em porcentagem nas peças escolhidas, com início e fim automáticos. Aparece na faixa da página inicial. Cupons não valem nas peças em promoção.</p></div>
        {!editing && <button className="btn solid" onClick={() => setEditing({})}><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>Nova promoção</button>}
      </div>
      {editing && <Editor key={editing.id || 'nova'} promo={editing} products={products} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg('Promoção salva.'); load(); }} />}
      {msg && <p className="okmsg" role="status">{msg}</p>}
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : rows.length ? (
        <div className="table-wrap"><table className="t" style={{ minWidth: 760 }}>
          <thead><tr><th>Promoção</th><th>Desconto</th><th>Período</th><th>Peças</th><th>Situação</th><th /></tr></thead>
          <tbody>{rows.map((p) => {
            const st = promoStatus(p);
            const ids = (p.product_ids || []).filter((id) => names[id]);
            return (
              <tr key={p.id} style={{ cursor: 'default' }}>
                <td><b style={{ fontWeight: 500 }}>{p.name}</b></td>
                <td>{Number(p.percent)}%</td>
                <td className="muted">{fmtDateTime(p.starts_at)} → {fmtDateTime(p.ends_at)}</td>
                <td title={ids.map((id) => names[id]).join('\n')}>{ids.length} {ids.length === 1 ? 'peça' : 'peças'}</td>
                <td><span className={`badge ${STATUS_UI[st].tone}`}>{STATUS_UI[st].label}</span></td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn small ghost" onClick={() => setEditing(p)}>Editar</button>{' '}
                  {st === 'active' && <><button className="btn small ghost" onClick={() => update(p, { active: false }, 'Promoção pausada.')}>Pausar</button>{' '}<button className="btn small ghost" onClick={() => endNow(p)}>Encerrar agora</button>{' '}</>}
                  {st === 'paused' && <><button className="btn small ghost" onClick={() => update(p, { active: true }, 'Promoção retomada.')}>Retomar</button>{' '}</>}
                  <button className="btn small danger" onClick={() => remove(p)}>Excluir</button>
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ) : !editing && <div className="empty">Nenhuma promoção criada ainda. Clique em <b>Nova promoção</b> para começar.</div>}
    </>
  );
}
