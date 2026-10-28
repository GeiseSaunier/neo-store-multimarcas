'use client';
import './styles/base.css';
import './styles/layout.css';
import './styles/controls.css';
import './styles/dashboard.css';
import './styles/orders.css';
import './styles/products.css';
import './styles/notifications.css';
import './styles/login.css';
import './styles/responsive.css'; // sempre por último
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminCtx } from './_ctx';
import { useConfirm } from './_components/ConfirmDialog';
import { supabase } from '@/lib/supabase-browser';
import { brl, fmtDateTime } from '@/lib/format';


const NAV = [
  { href: '/admin', label: 'Visão geral', icon: <path d="M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 7h6V4h-6z" /> },
  { href: '/admin/pedidos', label: 'Pedidos', icon: <><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>, count: true },
  { href: '/admin/produtos', label: 'Produtos', icon: <><path d="M4 7l8-4 8 4-8 4z" /><path d="M4 7v10l8 4 8-4V7" /><path d="M12 11v10" /></> },
  { href: '/admin/fretes', label: 'Entregas', icon: <><path d="M3 15h18l-2 4H5z" /><path d="M6 15V9h8l3 6M9 9V5h4v4" /></> },
  { href: '/admin/promocoes', label: 'Promoções', icon: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></> },
  { href: '/admin/cupons', label: 'Cupons', icon: <><path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4z" transform="translate(0 2)" /><path d="M10 9l4 4M14 9h0M10 13h0" /></> },
  { href: '/admin/assinantes', label: 'Novidades', icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 7 8.5-7" /></> },
];

function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.14 + 0.5);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.14); o.stop(ctx.currentTime + i * 0.14 + 0.55);
    });
  } catch {}
}

export default function AdminLayout({ children }) {
  const path = usePathname();
  const router = useRouter();
  const sb = supabase();
  const [state, setState] = useState('loading'); // loading | out | denied | ok
  const [session, setSession] = useState(null);
  const [unseen, setUnseen] = useState([]);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [perm, setPerm] = useState('default');
  const notified = useRef(new Set());
  const isLogin = path === '/admin/login';
  const { ask, element: confirmDialog } = useConfirm(); // confirmações com o visual do painel

  // ---------- autenticação ----------
  useEffect(() => {
    let alive = true, checkedUser = null;
    async function check(s) {
      if (!alive) return;
      setSession(s);
      if (!s) { checkedUser = null; setState('out'); return; }
      if (s.user.id === checkedUser) return; // mesmo usuário (ex.: login renovado): já conferido
      checkedUser = s.user.id;
      const { data } = await sb.rpc('is_admin');
      if (alive) setState(data ? 'ok' : 'denied');
    }
    sb.auth.getSession().then(({ data }) => check(data.session));
    // O Supabase pede para não chamar o banco dentro deste aviso (pode travar o login):
    // a conferência roda logo depois que ele termina.
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { setTimeout(() => check(s), 0); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [sb]);

  useEffect(() => {
    if (state === 'out' && !isLogin) router.replace('/admin/login');
    if (state === 'ok' && isLogin) router.replace('/admin');
  }, [state, isLogin, router]);

  useEffect(() => { setMenu(false); setOpen(false); }, [path]);
  useEffect(() => { if (typeof Notification !== 'undefined') setPerm(Notification.permission); }, []);

  // ---------- notificações ----------
  const loadUnseen = useCallback(async () => {
    const { data } = await sb.from('orders').select('id,code,status,total,customer_name,created_at,paid_at').eq('seen', false)
      .in('status', ['pending', 'paid']).order('created_at', { ascending: false }).limit(30);
    setUnseen(data || []);
  }, [sb]);

  const pushToast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((l) => [...l, { ...t, id }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 7000);
    chime();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(t.title, { body: t.body, icon: '/brand/mono.png' }); } catch {}
    }
  }, []);

  useEffect(() => {
    if (state !== 'ok') return;
    loadUnseen();
    const ch = sb.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, ({ eventType, new: o }) => {
        if (!o?.id) return;
        if (eventType === 'INSERT' && !notified.current.has('n' + o.id)) {
          notified.current.add('n' + o.id);
          pushToast({ title: `Novo pedido #${o.code}`, body: `${o.customer_name} · ${brl(o.total)} · aguardando pagamento`, href: `/admin/pedidos?id=${o.id}` });
        }
        if (eventType === 'UPDATE' && o.status === 'paid' && o.paid_at && Date.now() - new Date(o.paid_at).getTime() < 120000 && !notified.current.has('p' + o.id)) {
          notified.current.add('p' + o.id);
          pushToast({ title: `Pagamento confirmado #${o.code}`, body: `${o.customer_name} · ${brl(o.total)}`, href: `/admin/pedidos?id=${o.id}`, ok: true });
        }
        loadUnseen();
        window.dispatchEvent(new CustomEvent('orders-changed'));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [state, sb, loadUnseen, pushToast]);

  async function markAllSeen() {
    const ids = unseen.map((o) => o.id);
    if (ids.length) await sb.from('orders').update({ seen: true }).in('id', ids);
    loadUnseen();
  }
  async function askPerm() {
    if (typeof Notification === 'undefined') return;
    setPerm(await Notification.requestPermission());
  }
  async function signOut() { await sb.auth.signOut(); router.replace('/admin/login'); }

  if (isLogin) return state === 'ok' ? null : children;
  if (state === 'loading' || state === 'out') return <div className="empty" style={{ paddingTop: '30vh' }}><span className="mono" />Carregando painel…</div>;
  if (state === 'denied') return (
    <div className="empty" style={{ paddingTop: '25vh' }}>
      <span className="mono" />
      <p>Esta conta ({session?.user?.email}) não tem acesso ao painel.</p>
      <p className="muted">Peça para um administrador liberar o seu acesso (veja o README do projeto).</p>
      <button className="btn ghost" onClick={signOut}>Sair</button>
    </div>
  );

  const pendingCount = unseen.length;
  return (
    <AdminCtx.Provider value={{ sb, session, refreshUnseen: loadUnseen, pushToast, ask }}>
      <div className="shell">
        <aside className={`side ${menu ? 'open' : ''}`}>
          <Link href="/admin" className="brand"><span className="mono" /><span><b>NEO STORE</b><small>PAINEL</small></span></Link>
          <nav>
            {NAV.map((n) => {
              const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={on ? 'on' : ''}>
                  <svg viewBox="0 0 24 24">{n.icon}</svg>{n.label}
                  {n.count && pendingCount > 0 && <span className="count">{pendingCount}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="foot">
            <a href="/" target="_blank" rel="noopener">Ver loja</a>
            <span>{session?.user?.email}</span>
            <button onClick={signOut}>Sair</button>
          </div>
        </aside>
        {menu && <div className="scrim" style={{ zIndex: 35 }} onClick={() => setMenu(false)} />}
        <div className="main">
          <div className="topbar">
            <button className="icon-btn menu-btn" aria-label="Abrir menu" onClick={() => setMenu(true)}><svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h12" /></svg></button>
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" aria-label="Notificações" onClick={() => setOpen((v) => !v)}>
                <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
                {pendingCount > 0 && <span className="dot">{pendingCount}</span>}
              </button>
              {open && (
                <div className="notif">
                  <div className="nh"><span>Notificações</span>{pendingCount > 0 && <button onClick={markAllSeen}>Marcar como vistas</button>}</div>
                  {perm !== 'granted' && typeof Notification !== 'undefined' && (
                    <div className="perm"><span>Receba avisos mesmo com o painel em outra aba.</span><button className="btn small ghost" onClick={askPerm}>Ativar</button></div>
                  )}
                  {unseen.length ? (
                    <ul>
                      {unseen.map((o) => (
                        <li key={o.id}>
                          <Link href={`/admin/pedidos?id=${o.id}`} onClick={() => setOpen(false)}>
                            <span className={`ic ${o.status === 'paid' ? 'ok' : 'wait'}`}>{o.status === 'paid' ? '✓' : '•'}</span>
                            <span>{o.status === 'paid' ? 'Pagamento confirmado' : 'Novo pedido'} #{o.code} · {brl(o.total)}</span>
                            <small>{o.customer_name} · {fmtDateTime(o.paid_at || o.created_at)}</small>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="empty" style={{ padding: 30 }}>Nenhuma novidade por aqui.</div>}
                </div>
              )}
            </div>
          </div>
          <div className="page">{children}</div>
        </div>
        {confirmDialog}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <Link key={t.id} href={t.href} className="toastx" style={t.ok ? { background: '#4E6B4A' } : null}>
              <b>{t.title}</b><small>{t.body}</small>
            </Link>
          ))}
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
