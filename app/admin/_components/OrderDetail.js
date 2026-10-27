'use client';
// Gaveta lateral com os detalhes de um pedido e as ações de status.
import { useEffect, useState } from 'react';
import { useAdmin } from '../_ctx';
import { brl, fmtDateTime, onlyDigits } from '@/lib/format';
import { STATUS, PAYMENT_LABEL, SUBS, NEXT_STATUS, brandName } from '@/lib/config';

const fmtPhone = (v) => { const d = onlyDigits(v); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : v; };

export default function OrderDetail({ order, onClose, onSaved }) {
  const { sb, session, refreshUnseen } = useAdmin();
  const [tracking, setTracking] = useState(order.tracking_code || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!order.seen) sb.from('orders').update({ seen: true }).eq('id', order.id).then(() => refreshUnseen());
  }, [order.id, order.seen, sb, refreshUnseen]);

  // Salva pelo servidor, que também envia os e-mails para a cliente.
  async function save(status) {
    const r = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ status, tracking_code: tracking, notes }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    return r?.ok ? null : j.error || 'Não foi possível salvar. Confira a internet e tente de novo.';
  }
  async function setStatus(status) {
    if (status === 'cancelled' && !confirm(`Cancelar o pedido #${order.code}? As peças voltam para o estoque. Se ele já foi pago, faça o reembolso pelo Mercado Pago.`)) return;
    if (status === 'paid' && !confirm(`Marcar o pedido #${order.code} como pago? Use só se você conferiu o pagamento. A cliente recebe o e-mail de confirmação.`)) return;
    setBusy(status); setMsg('');
    const err = await save(status);
    setBusy('');
    if (err) { setMsg(err); return; }
    setMsg(`Pedido marcado como ${STATUS[status].label.toLowerCase()}.`); onSaved();
  }
  async function saveNotes() {
    setBusy('notes');
    const err = await save();
    setBusy(''); setMsg(err || 'Anotações salvas.'); if (!err) onSaved();
  }

  const a = order.address || {};
  const wa = `https://wa.me/55${onlyDigits(order.phone)}?text=${encodeURIComponent(`Olá, ${order.customer_name.split(' ')[0]}! Aqui é da Neo Store, sobre o seu pedido #${order.code}.`)}`;
  const next = NEXT_STATUS[order.status];
  const btnLabel = { paid: 'Marcar como pago', shipped: 'Marcar como enviado', delivered: 'Marcar como entregue', cancelled: 'Cancelar pedido', pending: 'Reabrir pedido' };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Pedido ${order.code}`}>
        <div className="head">
          <div><h2>Pedido #{order.code}</h2><p className="muted" style={{ margin: '8px 0 0' }}>{fmtDateTime(order.created_at)} · <span className={`badge ${STATUS[order.status].tone}`}>{STATUS[order.status].label}</span></p></div>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="body">
          {order.stock_issue && (
            <div className="alert" role="alert">
              <b>Estoque insuficiente.</b> O pagamento chegou depois de a peça ter sido vendida para outra cliente: {order.stock_issue}.
              Fale com a cliente para oferecer outra peça ou o reembolso pelo Mercado Pago. Se cancelar, ajuste o estoque da peça manualmente.
            </div>
          )}
          <section>
            <h3>Peças</h3>
            {(order.order_items || []).map((i) => (
              <div className="line-item" key={i.id}>
                {i.image ? <img className="thumb" src={i.image} alt="" /> : <span className="thumb" />}
                <div><b style={{ fontWeight: 500 }}>{i.qty}× {i.name}</b><div className="muted">{brandName(i.brand, i.brand_label)} · {SUBS[i.category]}{i.size && i.size !== 'Único' ? ` · Tam. ${i.size}` : ''}{i.color ? <> · <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: i.color, border: '1px solid var(--line2)', verticalAlign: -1 }} /></> : null}</div></div>
                <span>{brl(i.unit_price * i.qty)}</span>
              </div>
            ))}
            <div className="sum">
              <div><span>Subtotal</span><span>{brl(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div><span>Cupom {order.coupon}</span><span>− {brl(order.discount)}</span></div>}
              <div><span>Frete</span><span>{order.shipping_to_confirm ? 'A combinar' : brl(order.shipping_cost)}</span></div>
              {Number(order.pix_discount) > 0 && <div><span>Desconto PIX</span><span>− {brl(order.pix_discount)}</span></div>}
              <div className="tot"><span>Total</span><span>{brl(order.total)}</span></div>
            </div>
          </section>
          <section>
            <h3>Cliente</h3>
            <div className="kv"><span>Nome</span><span>{order.customer_name}</span><span>E-mail</span><span><a href={`mailto:${order.email}`}>{order.email}</a></span><span>Celular</span><span>{fmtPhone(order.phone)}</span><span>CPF</span><span>{String(order.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</span></div>
            <a className="btn small ghost" href={wa} target="_blank" rel="noopener" style={{ marginTop: 12 }}>Chamar no WhatsApp</a>
          </section>
          <section>
            <h3>Entrega</h3>
            <div className="kv"><span>Forma</span><span>{order.shipping_label}{order.shipping_to_confirm ? ' (valor a combinar)' : ''}</span>
              <span>Endereço</span><span>{a.rua}, {a.num}{a.comp ? ` · ${a.comp}` : ''}<br />{a.bairro} · {a.cidade} · CEP {a.cep}</span></div>
          </section>
          <section>
            <h3>Pagamento</h3>
            <div className="kv"><span>Forma</span><span>{PAYMENT_LABEL[order.payment_method]}</span>
              <span>Mercado Pago</span><span>{order.mp_payment_id ? `#${order.mp_payment_id} · ${order.mp_status || ''}` : 'aguardando'}</span>
              {order.paid_at && <><span>Pago em</span><span>{fmtDateTime(order.paid_at)}</span></>}</div>
          </section>
          <section>
            <h3>Acompanhamento</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="field"><label htmlFor="trk">Código de rastreio (opcional)</label><input id="trk" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Ex.: AA123456789BR" /></div>
              <div className="field"><label htmlFor="nts">Anotações internas</label><textarea id="nts" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80 }} /></div>
              <div><button className="btn small ghost" onClick={saveNotes} disabled={!!busy}>Salvar anotações</button></div>
            </div>
          </section>
          {next.length > 0 && (
            <section>
              <h3>Atualizar status</h3>
              <div className="actions">
                {next.map((s) => <button key={s} className={`btn small ${s === 'cancelled' ? 'danger' : s === 'pending' ? 'ghost' : 'solid'}`} onClick={() => setStatus(s)} disabled={!!busy}>{busy === s ? 'Salvando…' : btnLabel[s]}</button>)}
              </div>
              {['paid', 'shipped'].includes(order.status) && <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Ao marcar como enviado ou entregue, a cliente recebe um e-mail{tracking ? ' com o código de rastreio' : ''}.</p>}
            </section>
          )}
          {msg && <p className="okmsg" role="status">{msg}</p>}
        </div>
      </aside>
    </>
  );
}

