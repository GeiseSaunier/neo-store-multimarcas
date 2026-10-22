'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../_ctx';
import { brl } from '@/lib/format';
import { BRANDS, SUBS } from '@/lib/config';

export default function Products() {
  const { sb } = useAdmin();
  const [rows, setRows] = useState(null);
  const [brand, setBrand] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    sb.from('products').select('*').order('position').order('created_at', { ascending: false }).then(({ data }) => setRows(data || []));
  }, [sb]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows || []).filter((p) => (brand === 'all' || p.brand === brand) && (!t || p.name.toLowerCase().includes(t)));
  }, [rows, brand, q]);

  return (
    <>
      <div className="page-head">
        <div><h1>Produtos</h1><p>{rows ? `${rows.filter((p) => p.active).length} peças à venda na loja.` : ' '}</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Buscar peça" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <Link href="/admin/produtos/nova" className="btn solid"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>Nova peça</Link>
        </div>
      </div>
      <div className="seg" role="group" aria-label="Filtrar por marca" style={{ marginBottom: 18 }}>
        <button aria-pressed={brand === 'all'} onClick={() => setBrand('all')}>Todas</button>
        {Object.entries(BRANDS).map(([k, b]) => <button key={k} aria-pressed={brand === k} onClick={() => setBrand(k)}>{b.name}</button>)}
      </div>
      {!rows ? <div className="empty"><span className="mono" />Carregando…</div> : (
        <div className="pgrid">
          <Link href="/admin/produtos/nova" className="pcard add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>Cadastrar nova peça</Link>
          {list.map((p) => (
            <Link key={p.id} href={`/admin/produtos/${p.id}`} className={`pcard ${p.active ? '' : 'off'}`}>
              <div className="img">
                {p.images?.[0] && <img src={p.images[0]} alt="" />}
                {!p.active ? <span className="badge done">Oculta</span> : p.stock === 0 ? <span className="badge bad">Esgotada</span> : null}
              </div>
              <div className="info">
                <b>{p.name}</b>
                <span className="muted" style={{ fontSize: 12 }}>{BRANDS[p.brand]?.name} · {SUBS[p.category]}</span>
                <span>{p.old_price ? <s className="muted" style={{ fontSize: 12, marginRight: 6 }}>{brl(p.old_price)}</s> : null}{brl(p.price)}{p.stock != null ? <span className="muted" style={{ fontSize: 12 }}> · {p.stock} em estoque</span> : null}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
