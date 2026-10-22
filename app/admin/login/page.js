'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';

export default function Login() {
  const sb = supabase();
  const [mode, setMode] = useState('login'); // login | forgot | reset
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState({ t: '', ok: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setMode('reset'); });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg({ t: '' });
    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) setMsg({ t: 'E-mail ou senha incorretos. Confira e tente de novo.' });
    } else if (mode === 'forgot') {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/admin/login` });
      setMsg(error ? { t: 'Não foi possível enviar o e-mail agora.' } : { t: 'Enviamos um link para criar uma nova senha. Confira sua caixa de entrada.', ok: true });
    } else {
      if (pass.length < 8) { setMsg({ t: 'Use pelo menos 8 caracteres.' }); setBusy(false); return; }
      const { error } = await sb.auth.updateUser({ password: pass });
      setMsg(error ? { t: 'Não foi possível salvar a nova senha.' } : { t: 'Senha atualizada. Entrando…', ok: true });
    }
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="art"><span className="mono" /><p>NEO STORE MULTIMARCAS</p></div>
      <div className="box">
        <form onSubmit={submit}>
          <h1>{mode === 'login' ? 'Entrar no painel' : mode === 'forgot' ? 'Recuperar senha' : 'Criar nova senha'}</h1>
          {mode !== 'reset' && (
            <div className="field"><label htmlFor="em">E-mail</label><input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          )}
          {mode !== 'forgot' && (
            <div className="field"><label htmlFor="pw">{mode === 'reset' ? 'Nova senha' : 'Senha'}</label><input id="pw" type="password" autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} required /></div>
          )}
          {msg.t && <p className={msg.ok ? 'okmsg' : 'err'} role="alert" style={{ margin: 0 }}>{msg.t}</p>}
          <button className="btn solid" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar link' : 'Salvar senha'}</button>
          {mode === 'login' && <button type="button" className="link" onClick={() => { setMode('forgot'); setMsg({ t: '' }); }}>Esqueci a senha</button>}
          {mode === 'forgot' && <button type="button" className="link" onClick={() => { setMode('login'); setMsg({ t: '' }); }}>Voltar para o login</button>}
        </form>
      </div>
    </div>
  );
}
