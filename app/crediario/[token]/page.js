'use client';
// Extrato do crediário para a cliente: o que já pagou, em que dia, e quanto falta.
import '../../pedido/[id]/pedido.css';
import './crediario.css';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { brl } from '@/lib/format';
import { fmtDay } from '@/lib/crediario';
import { STORE } from '@/lib/config';

export default function Statement() {
  const { token } = useParams();
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/crediario/${token}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setS(j); })
      .catch((e) => setErr(e.message || 'Extrato não encontrado.'));
  }, [token]);

  const wa = (text) => `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;

  return (
    <main className="op">
      <div className="box">
        <span className="mono" />
        {err ? (<>
          <h1>Extrato não encontrado</h1>
          <p>Confira o link ou fale com a gente.</p>
          <a className="btn ghost" href={wa('Olá! Não consegui abrir o extrato do meu crediário.')}>Falar no WhatsApp</a>
        </>) : !s ? <p>Carregando…</p> : (<>
          <h1>{s.settled ? `Tudo pago, ${s.first_name}!` : `Olá, ${s.first_name}!`}</h1>
          <p>{s.description || 'Compra a prazo'} · {fmtDay(s.sold_on)}</p>

          <div className="cr-sum">
            <div><span>Total da compra</span><b>{brl(s.total)}</b></div>
            <div><span>Já pagou</span><b>{brl(s.paid)}</b></div>
            <div className="left"><span>{s.settled ? 'Situação' : 'Falta pagar'}</span><b>{s.settled ? 'Quitada' : brl(s.left)}</b></div>
          </div>

          <h2 className="cr-h">Seus pagamentos</h2>
          {s.payments.length ? (
            <ul className="cr-list">
              {[...s.payments].reverse().map((p, i) => (
                <li key={i}>
                  <span><b>{brl(p.amount)}</b> em {fmtDay(p.paid_on)}</span>
                  <small>{p.left > 0 ? `faltavam ${brl(p.left)}` : 'quitou'}</small>
                </li>
              ))}
            </ul>
          ) : <p>Nenhum pagamento registrado ainda.</p>}

          <p style={{ marginTop: 22, fontSize: 13 }}>Algum pagamento não aparece aqui? Mande o comprovante que a gente confere.</p>
          <a className="btn solid" href={wa(`Olá! Aqui é ${s.first_name}, do crediário (${s.description || 'compra a prazo'}). ${s.settled ? 'Tenho uma dúvida.' : `Quero falar sobre o saldo de ${brl(s.left)}.`}`)} target="_blank" rel="noopener">Falar no WhatsApp</a>
        </>)}
      </div>
    </main>
  );
}
