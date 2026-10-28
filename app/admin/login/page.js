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
    // validação com as mensagens do painel (no lugar dos balões do navegador)
    const em = email.trim();
    if (mode !== 'reset' && !em) return setMsg({ t: 'Digite o seu e-mail.' });
    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(em)) return setMsg({ t: 'Confira o e-mail: ele precisa ter o formato nome@exemplo.com.' });
    if (mode !== 'forgot' && !pass) return setMsg({ t: mode === 'reset' ? 'Digite a nova senha.' : 'Digite a sua senha.' });
    setBusy(true); setMsg({ t: '' });
    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email: em, password: pass });
      if (error) setMsg({ t: 'E-mail ou senha incorretos. Confira e tente de novo.' });
    } else if (mode === 'forgot') {
      const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: `${location.origin}/admin/login` });
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
        <form onSubmit={submit} noValidate>
          <h1>{mode === 'login' ? 'Entrar no painel' : mode === 'forgot' ? 'Recuperar senha' : 'Criar nova senha'}</h1>
          {mode !== 'reset' && (
            <div className="field"><label htmlFor="em">E-mail</label><input id="em" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setMsg({ t: '' }); }} aria-invalid={/e-mail/i.test(msg.t) && !msg.ok} /></div>
          )}
          {mode !== 'forgot' && (
            <div className="field"><label htmlFor="pw">{mode === 'reset' ? 'Nova senha' : 'Senha'}</label><input id="pw" type="password" autoComplete={mode === 'reset' ? 'new-password' : 'current-password'} value={pass} onChange={(e) => { setPass(e.target.value); setMsg({ t: '' }); }} aria-invalid={/senha/i.test(msg.t) && !msg.ok} /></div>
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
