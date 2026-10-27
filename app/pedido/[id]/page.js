'use client';
import './pedido.css';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { brl } from '@/lib/format';
import { STORE } from '@/lib/config';

// A loja guarda a sacola até o pagamento ser confirmado; ao voltar do Mercado Pago com o pedido pago, esvazia.
function clearCart(id) {
  try {
    if (JSON.parse(localStorage.getItem('neo-last-order')) !== id) return;
    ['neo-cart', 'neo-coupon', 'neo-last-order'].forEach((k) => localStorage.setItem(k, k === 'neo-cart' ? '[]' : 'null'));
  } catch {}
}

export default function OrderStatus() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let t;
    async function load() {
      try {
        const r = await fetch(`/api/orders/${id}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setO(j);
        if (j.status === 'pending') t = setTimeout(load, 6000);
        if (['paid', 'shipped', 'delivered'].includes(j.status)) clearCart(id);
      } catch (e) { setErr(e.message || 'Pedido não encontrado.'); }
    }
    load();
    return () => clearTimeout(t);
  }, [id]);

  const wa = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pedido #${o?.code || ''}.`)}`;
  const paid = o && ['paid', 'shipped', 'delivered'].includes(o.status);

  return (
    <main className="op">
      <div className="box">
        <span className="mono" />
        {err ? (<><h1>Pedido não encontrado</h1><p>Confira o link ou fale com a gente.</p><a className="btn ghost" href={wa}>Falar no WhatsApp</a></>)
          : !o ? <p>Carregando…</p>
          : paid ? (<>
              <h1>Pagamento confirmado{o.first_name ? `, ${o.first_name}` : ''}.</h1>
              <p>Pedido <b>#{o.code}</b> · {brl(o.total)}</p>
              <p>Já estamos separando suas peças. As atualizações chegam em {o.email}.</p>
              {o.tracking_code && <p>Código de rastreio: <b>{o.tracking_code}</b></p>}
              <a className="btn solid" href="/">Voltar para a loja</a>
            </>)
          : o.status === 'cancelled' ? (<>
              <h1>Pedido #{o.code} cancelado</h1>
              <p>O pagamento não foi concluído a tempo. Se quiser, faça o pedido de novo ou fale com a gente.</p>
              <a className="btn solid" href="/">Voltar para a loja</a><a className="btn ghost" href={wa}>Falar no WhatsApp</a>
            </>)
          : (<>
              <h1>Aguardando o pagamento</h1>
              <p>Pedido <b>#{o.code}</b> · {brl(o.total)}</p>
              {o.payment_method === 'pix' && o.pix_qr ? (<>
                <div className="qr">{o.pix_qr_base64 && <img src={`data:image/png;base64,${o.pix_qr_base64}`} alt="QR Code PIX" />}</div>
                <div className="code">{o.pix_qr}</div>
                <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(o.pix_qr).then(() => setCopied(true))}>{copied ? 'Código copiado' : 'Copiar código PIX'}</button>
              </>) : <p>{o.payment_method === 'boleto' ? 'Assim que o boleto for compensado (até 2 dias úteis), confirmamos por e-mail.' : 'Estamos aguardando a confirmação do Mercado Pago. Isso costuma levar poucos instantes.'}</p>}
              <p style={{ marginTop: 16, fontSize: 13 }}>Esta página se atualiza sozinha.</p>
            </>)}
      </div>
    </main>
  );
}
