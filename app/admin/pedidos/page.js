'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '../_ctx';
import { brl, fmtDateTime } from '@/lib/format';
import { STATUS, PAYMENT_LABEL } from '@/lib/config';
import { downloadCsv } from '@/lib/csv';
import OrderDetail from '../_components/OrderDetail';

const FILTERS = [['all', 'Todos'], ['pending', 'Aguardando'], ['paid', 'Pagos'], ['shipped', 'Enviados'], ['delivered', 'Entregues'], ['cancelled', 'Cancelados'], ['refunded', 'Reembolsados']];
const PAGE = 500;

function exportOrders(rows) {
  downloadCsv(`pedidos-neo-store-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Pedido', 'Data', 'Status', 'Cliente', 'E-mail', 'Telefone', 'CPF', 'Cidade', 'Entrega', 'Frete', 'Pagamento', 'Subtotal', 'Desconto', 'Desconto PIX', 'Total', 'Itens'],
    rows.map((o) => [o.code, fmtDateTime(o.created_at), STATUS[o.status].label, o.customer_name, o.email, o.phone, o.cpf, o.address?.cidade, o.shipping_label, o.shipping_cost, PAYMENT_LABEL[o.payment_method], o.subtotal, o.discount, o.pix_discount, o.total,
      (o.order_items || []).map((i) => `${i.qty}x ${i.name}${i.size && i.size !== 'Único' ? ' (' + i.size + ')' : ''}`).join(' | ')]));
}

function Orders() {
  const { sb } = useAdmin();
  const params = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState(params.get('status') || 'all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const openId = params.get('id');

  const load = useCallback(async () => {
    const { data } = await sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(limit);
    setRows(data || []);
  }, [sb, limit]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const f = () => load(); window.addEventListener('orders-changed', f); return () => window.removeEventListener('orders-changed', f); }, [load]);

  const counts = useMemo(() => {
    const c = { all: rows?.length || 0 };
    (rows || []).forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; });
    return c;
  }, [rows]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((o) => (filter === 'all' || o.status === filter) &&
      (!t || String(o.code).includes(t) || o.customer_name.toLowerCase().includes(t) || o.email.includes(t) || (o.address?.cidade || '').toLowerCase().includes(t)));
  }, [rows, filter, q]);
  const open = rows?.find((o) => o.id === openId);
  const setOpen = (id) => router.replace(id ? `/admin/pedidos?id=${id}` : '/admin/pedidos', { scroll: false });

  return (
    <>
      <div className="page-head">
        <div><h1>Pedidos</h1><p>Acompanhe pagamentos, separe e envie os pedidos.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Buscar por número, nome ou cidade" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />
          <button className="btn ghost" onClick={() => exportOrders(list)} disabled={!list.length}>Exportar planilha</button>
        </div>
      </div>
      <div className="seg" role="group" aria-label="Filtrar pedidos" style={{ marginBottom: 18 }}>
        {FILTERS.map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}<span className="n">{counts[k] || 0}</span></button>)}
      </div>
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : list.length ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Entrega</th><th>Pagamento</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className={!o.seen ? 'new' : ''} onClick={() => setOpen(o.id)}>
                  <td className="code">#{o.code}</td>
                  <td className="muted">{fmtDateTime(o.created_at)}</td>
                  <td>{o.customer_name}<div className="muted" style={{ fontSize: 12 }}>{o.address?.cidade}</div></td>
                  <td>{o.shipping_label.replace(/ \(via Melhor Envio\)/, '')}</td>
                  <td>{PAYMENT_LABEL[o.payment_method]}</td>
                  <td><span className={`badge ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span></td>
                  <td className="num">{brl(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty"><span className="mono" />{rows.length ? 'Nenhum pedido com esse filtro.' : 'Os pedidos feitos na loja aparecem aqui.'}</div>}
      {rows?.length === limit && <div style={{ textAlign: 'center', marginTop: 18 }}><button className="btn ghost" onClick={() => setLimit((l) => l + PAGE)}>Carregar pedidos mais antigos</button></div>}
      {open && <OrderDetail key={open.id} order={open} onClose={() => setOpen(null)} onSaved={load} />}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Orders /></Suspense>;
}
