'use client';
import { useEffect, useState } from 'react';
import { useAdmin } from '../_ctx';

const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function Row({ o, onSaved, onRemoved }) {
  const { sb, ask } = useAdmin();
  const [f, setF] = useState({ ...o, price: String(o.price), price_label: o.price_label || '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function save() {
    const row = { name: f.name.trim(), description: f.description.trim(), price: Number(String(f.price).replace(',', '.')) || 0, price_label: f.price_label.trim() || null, to_confirm: f.to_confirm, active: f.active, position: Number(f.position) || 0 };
    if (!row.name) return setMsg('Dê um nome para a opção.');
    const { error } = await sb.from('shipping_options').update(row).eq('id', o.id);
    setMsg(error ? 'Não foi possível salvar.' : 'Salvo.'); if (!error) onSaved();
  }
  async function remove() {
    if (!(await ask({ title: `Excluir a entrega “${o.name}”?`, message: 'Ela some do checkout. Para tirar só por um tempo, desligue “Disponível na loja”.', confirmLabel: 'Excluir entrega', danger: true }))) return;
    await sb.from('shipping_options').delete().eq('id', o.id); onRemoved();
  }
  return (
    <div className="card" style={{ display: 'grid', gap: 14, opacity: f.active ? 1 : .65 }}>
      <div className="row">
        <div className="field"><label>Nome</label><input value={f.name} onChange={set('name')} /></div>
        <div className="field"><label>Valor cobrado (R$)</label><input inputMode="decimal" value={f.price} onChange={set('price')} /><span className="help">{f.to_confirm ? 'Não é cobrado no pedido: o valor é combinado pelo WhatsApp.' : 'Este valor entra no total do pedido.'}</span></div>
        <div className="field"><label>Texto do valor (opcional)</label><input value={f.price_label} onChange={set('price_label')} placeholder="Ex.: R$ 40 a R$ 60" /><span className="help">Aparece no lugar do valor para a cliente.</span></div>
      </div>
      <div className="field"><label>Descrição</label><input value={f.description} onChange={set('description')} /></div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="switch"><input type="checkbox" checked={f.active} onChange={set('active')} />Disponível na loja</label>
        <label className="switch"><input type="checkbox" checked={f.to_confirm} onChange={set('to_confirm')} />Valor combinado pelo WhatsApp</label>
        <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="label">Ordem</span><input style={{ width: 70 }} inputMode="numeric" value={f.position} onChange={set('position')} /></label>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {msg && <span className="okmsg">{msg}</span>}
          <button className="btn small danger" onClick={remove}>Excluir</button>
          <button className="btn small solid" onClick={save}>Salvar</button>
        </span>
      </div>
    </div>
  );
}

export default function Shipping() {
  const { sb } = useAdmin();
  const [rows, setRows] = useState(null);
  const [name, setName] = useState('');
  const load = () => sb.from('shipping_options').select('*').order('position').then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await sb.from('shipping_options').insert({ id: `${slug(name)}-${Date.now().toString(36)}`, name: name.trim(), price: 0, position: (rows?.length || 0) + 1 });
    setName(''); load();
  }
  return (
    <>
      <div className="page-head"><div><h1>Entregas</h1><p>Opções de entrega regional que aparecem no checkout. PAC e SEDEX são calculados automaticamente pelo CEP.</p></div></div>
      <form onSubmit={add} style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova opção, ex.: Barreirinha" style={{ maxWidth: 320 }} />
        <button className="btn solid">Adicionar opção</button>
      </form>
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : (
        <div style={{ display: 'grid', gap: 16 }}>{rows.map((o) => <Row key={o.id} o={o} onSaved={load} onRemoved={load} />)}</div>
      )}
    </>
  );
}
