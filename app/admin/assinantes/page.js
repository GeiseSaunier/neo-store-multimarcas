'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../_ctx';
import { fmtDate } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';

const fmtPhone = (v) => (v.length === 11 ? `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}` : v);

export default function Subscribers() {
  const { sb } = useAdmin();
  const [rows, setRows] = useState(null);
  const [ch, setCh] = useState('all');
  const load = () => sb.from('subscribers').select('*').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Pedido de exclusão da cliente (LGPD): apaga o contato de vez.
  const remove = async (r) => { if (confirm(`Excluir o contato ${r.contact} da lista de novidades?`)) { await sb.from('subscribers').delete().eq('id', r.id); load(); } };
  const list = useMemo(() => (rows || []).filter((r) => ch === 'all' || r.channel === ch), [rows, ch]);
  const exportCsv = () => downloadCsv('cadastros-novidades.csv', ['Canal', 'Contato', 'Data'],
    list.map((r) => [r.channel === 'email' ? 'E-mail' : 'WhatsApp', r.contact, fmtDate(r.created_at)]));
  const count = (c) => (rows || []).filter((r) => c === 'all' || r.channel === c).length;
  return (
    <>
      <div className="page-head"><div><h1>Novidades</h1><p>Clientes que pediram para receber lançamentos e ofertas.</p></div>
        <button className="btn ghost" onClick={exportCsv} disabled={!list.length}>Exportar planilha</button></div>
      <div className="seg" style={{ marginBottom: 18 }}>
        {[['all', 'Todos'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail']].map(([k, l]) => <button key={k} aria-pressed={ch === k} onClick={() => setCh(k)}>{l}<span className="n">{count(k)}</span></button>)}
      </div>
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : list.length ? (
        <div className="table-wrap"><table className="t" style={{ minWidth: 560 }}>
          <thead><tr><th>Contato</th><th>Canal</th><th>Desde</th><th /></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id} style={{ cursor: 'default' }}>
              <td>{r.channel === 'whatsapp' ? fmtPhone(r.contact) : r.contact}</td><td>{r.channel === 'email' ? 'E-mail' : 'WhatsApp'}</td><td className="muted">{fmtDate(r.created_at)}</td>
              <td className="num">{r.channel === 'whatsapp' ? <a className="btn small ghost" href={`https://wa.me/55${r.contact}`} target="_blank" rel="noopener">Abrir conversa</a> : <a className="btn small ghost" href={`mailto:${r.contact}`}>Enviar e-mail</a>} <button className="btn small danger" onClick={() => remove(r)}>Excluir</button></td>
            </tr>))}</tbody>
        </table></div>
      ) : <div className="empty">Os cadastros feitos no site aparecem aqui.</div>}
    </>
  );
}
