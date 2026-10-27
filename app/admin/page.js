'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdmin } from './_ctx';
import { brl, fmtDateTime, MONTHS } from '@/lib/format';
import { Delta, DailyChart, Bars } from './_components/charts';
import { BRANDS, SUBS, STATUS, PAID_STATUSES, PAYMENT_LABEL } from '@/lib/config';

export default function Dashboard() {
  const { sb } = useAdmin();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const start = new Date(ym.y, ym.m - 1, 1), end = new Date(ym.y, ym.m + 1, 1);
    const { data, error } = await sb.from('orders').select('*, order_items(*)')
      // pedidos criados ou pagos no período (boleto pago no mês seguinte conta no mês do pagamento)
      .or(`and(created_at.gte."${start.toISOString()}",created_at.lt."${end.toISOString()}"),and(paid_at.gte."${start.toISOString()}",paid_at.lt."${end.toISOString()}")`).order('created_at', { ascending: false });
    if (error) setErr('Não foi possível carregar os dados.'); else { setErr(''); setOrders(data); }
  }, [sb, ym]);
  useEffect(() => { setOrders(null); load(); }, [load]);
  useEffect(() => { const f = () => load(); window.addEventListener('orders-changed', f); return () => window.removeEventListener('orders-changed', f); }, [load]);

  const s = useMemo(() => {
    if (!orders) return null;
    // Vendas contam na data do pagamento; pedidos em aberto, na data em que foram feitos.
    const inMonth = (o, y, m) => { const d = new Date(PAID_STATUSES.includes(o.status) ? o.paid_at || o.created_at : o.created_at); return d.getFullYear() === y && d.getMonth() === m; };
    const prevY = ym.m === 0 ? ym.y - 1 : ym.y, prevM = (ym.m + 11) % 12;
    const cur = orders.filter((o) => inMonth(o, ym.y, ym.m));
    const prev = orders.filter((o) => inMonth(o, prevY, prevM));
    const paid = cur.filter((o) => PAID_STATUSES.includes(o.status));
    const paidPrev = prev.filter((o) => PAID_STATUSES.includes(o.status));
    const sum = (l) => l.reduce((a, o) => a + Number(o.total), 0);
    const rev = sum(paid), revPrev = sum(paidPrev);
    const pending = cur.filter((o) => o.status === 'pending');
    const dim = new Date(ym.y, ym.m + 1, 0).getDate();
    const days = Array.from({ length: dim }, () => ({ v: 0, n: 0 }));
    paid.forEach((o) => { const d = new Date(o.paid_at || o.created_at).getDate() - 1; days[d].v += Number(o.total); days[d].n++; });
    const group = (fn) => {
      const m = {};
      paid.forEach((o) => o.order_items.forEach((i) => { const k = fn(i, o); m[k] = (m[k] || 0) + Number(i.unit_price) * i.qty; }));
      return Object.entries(m).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    };
    const byOrder = (fn) => {
      const m = {};
      paid.forEach((o) => { const k = fn(o); m[k] = (m[k] || 0) + Number(o.total); });
      return Object.entries(m).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
    };
    const top = {};
    paid.forEach((o) => o.order_items.forEach((i) => {
      const k = i.product_id || i.name;
      top[k] = top[k] || { name: i.name, image: i.image, qty: 0, v: 0, brand: i.brand, category: i.category };
      top[k].qty += i.qty; top[k].v += Number(i.unit_price) * i.qty;
    }));
    return {
      rev, revPrev, count: paid.length, countPrev: paidPrev.length,
      avg: paid.length ? rev / paid.length : 0, avgPrev: paidPrev.length ? revPrev / paidPrev.length : 0,
      pending: pending.length, pendingValue: sum(pending), days,
      brands: group((i) => `${BRANDS[i.brand]?.name || i.brand} · ${SUBS[i.category] || i.category}`),
      payments: byOrder((o) => PAYMENT_LABEL[o.payment_method]),
      shipping: byOrder((o) => o.shipping_label.replace(/ \(via Melhor Envio\)/, '')),
      top: Object.values(top).sort((a, b) => b.qty - a.qty || b.v - a.v).slice(0, 5),
      recent: cur.slice(0, 8),
    };
  }, [orders, ym]);

  const shift = (d) => setYm(({ y, m }) => { const t = new Date(y, m + d, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();

  return (
    <>
      <div className="page-head">
        <div><h1>Visão geral</h1><p>Vendas confirmadas, pedidos e o que mais vendeu no mês.</p></div>
        <div className="month">
          <button className="icon-btn" aria-label="Mês anterior" onClick={() => shift(-1)}><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg></button>
          <b>{MONTHS[ym.m]} {ym.y}</b>
          <button className="icon-btn" aria-label="Próximo mês" onClick={() => shift(1)} disabled={isCurrent} style={isCurrent ? { opacity: .3 } : null}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {!s ? <div className="empty"><span className="mono" />Carregando…</div> : (
        <>
          <div className="hero-kpi">
            <div className="rev">
              <div className="lbl">Faturamento confirmado em {MONTHS[ym.m]}</div>
              <div className="big">{brl(s.rev)}</div>
              <Delta now={s.rev} before={s.revPrev} className="delta" />
            </div>
            <div className="kpis">
              <div className="kpi"><div className="lbl">Pedidos pagos</div><div className="v">{s.count}</div><Delta now={s.count} before={s.countPrev} className="s" /></div>
              <div className="kpi"><div className="lbl">Ticket médio</div><div className="v">{brl(s.avg)}</div><Delta now={s.avg} before={s.avgPrev} className="s" /></div>
              <div className="kpi" style={{ gridColumn: '1/-1' }}>
                <div className="lbl">Aguardando pagamento</div>
                <div className="v">{s.pending} {s.pending === 1 ? 'pedido' : 'pedidos'}</div>
                <div className="s">{brl(s.pendingValue)} em aberto · <Link href="/admin/pedidos?status=pending">ver pedidos</Link></div>
              </div>
            </div>
          </div>

          <div className="card"><h2>Faturamento por dia</h2><DailyChart days={s.days} /></div>

          <div className="grid2">
            <div className="card">
              <h2>Mais vendidos</h2>
              {s.top.length ? (
                <div className="rank">
                  {s.top.map((p) => (
                    <div className="it" key={p.name}>
                      {p.image ? <img className="thumb" src={p.image} alt="" /> : <span className="thumb" />}
                      <div><b>{p.name}</b><span className="muted">{BRANDS[p.brand]?.name} · {SUBS[p.category]}</span></div>
                      <div style={{ textAlign: 'right' }}><b>{p.qty} un.</b><span className="muted">{brl(p.v)}</span></div>
                    </div>
                  ))}
                </div>
              ) : <p className="muted" style={{ margin: 0 }}>Sem vendas no período.</p>}
            </div>
            <div className="card"><h2>Por marca</h2><Bars rows={s.brands} /></div>
          </div>

          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card"><h2>Por forma de entrega</h2><Bars rows={s.shipping} /></div>
            <div className="card"><h2>Por forma de pagamento</h2><Bars rows={s.payments} /></div>
          </div>

          <div className="card" style={{ marginTop: 20, padding: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 6px' }}>
              <h2 style={{ margin: 0 }}>Pedidos do mês</h2><Link href="/admin/pedidos" className="btn small ghost">Ver todos</Link>
            </div>
            {s.recent.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="t">
                  <tbody>
                    {s.recent.map((o) => (
                      <tr key={o.id} onClick={() => (location.href = `/admin/pedidos?id=${o.id}`)}>
                        <td className="code">#{o.code}</td><td>{o.customer_name}</td><td className="muted">{fmtDateTime(o.created_at)}</td>
                        <td><span className={`badge ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span></td><td className="num">{brl(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty">Nenhum pedido neste mês ainda.</div>}
          </div>
        </>
      )}
    </>
  );
}
