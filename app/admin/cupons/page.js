'use client';
import { useEffect, useState } from 'react';
import { useAdmin } from '../_ctx';

export default function Coupons() {
  const { sb, ask } = useAdmin();
  const [rows, setRows] = useState(null);
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('10');
  const [first, setFirst] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => sb.from('coupons').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function add(e) {
    e.preventDefault(); setMsg('');
    const c = code.trim().toUpperCase().replace(/\s+/g, '');
    const p = Number(String(pct).replace(',', '.'));
    if (!c) return setMsg('Digite o código do cupom.');
    if (!(p > 0 && p <= 100)) return setMsg('O desconto precisa estar entre 1% e 100%.');
    const { error } = await sb.from('coupons').insert({ code: c, percent: p, first_purchase: first });
    if (error) return setMsg(error.code === '23505' ? 'Já existe um cupom com esse código.' : 'Não foi possível criar o cupom.');
    setCode(''); setFirst(false); load();
  }
  const toggleFirst = async (c) => { await sb.from('coupons').update({ first_purchase: !c.first_purchase }).eq('code', c.code); load(); };
  const toggle = async (c) => { await sb.from('coupons').update({ active: !c.active }).eq('code', c.code); load(); };
  const remove = async (c) => { if (await ask({ title: `Excluir o cupom ${c.code}?`, message: 'Quem tiver o código não vai mais conseguir usar. Para parar só por um tempo, use “Pausado”.', confirmLabel: 'Excluir cupom', danger: true })) { await sb.from('coupons').delete().eq('code', c.code); load(); } };
  return (
    <>
      <div className="page-head"><div><h1>Cupons</h1><p>Códigos de desconto em porcentagem sobre as peças. Não vale para o frete nem para peças em promoção.</p></div></div>
      <form onSubmit={add} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="field"><label htmlFor="cc">Código</label><input id="cc" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: NATAL15" /></div>
        <div className="field" style={{ width: 120 }}><label htmlFor="cp">Desconto (%)</label><input id="cp" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
        <label className="switch" style={{ marginBottom: 10 }}><input type="checkbox" checked={first} onChange={(e) => setFirst(e.target.checked)} />Só na primeira compra</label>
        <button className="btn solid">Criar cupom</button>
        {msg && <span className="err">{msg}</span>}
      </form>
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : rows.length ? (
        <div className="table-wrap"><table className="t" style={{ minWidth: 620 }}>
          <thead><tr><th>Código</th><th>Desconto</th><th>Uso</th><th>Situação</th><th /></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.code} style={{ cursor: 'default' }}>
              <td className="code">{c.code}</td><td>{Number(c.percent)}%</td>
              <td><label className="switch"><input type="checkbox" checked={c.first_purchase} onChange={() => toggleFirst(c)} />{c.first_purchase ? 'Só 1ª compra por CPF' : 'Qualquer compra'}</label></td>
              <td><label className="switch"><input type="checkbox" checked={c.active} onChange={() => toggle(c)} />{c.active ? 'Ativo' : 'Pausado'}</label></td>
              <td className="num"><button className="btn small danger" onClick={() => remove(c)}>Excluir</button></td>
            </tr>))}</tbody>
        </table></div>
      ) : <div className="empty">Nenhum cupom criado ainda.</div>}
    </>
  );
}
