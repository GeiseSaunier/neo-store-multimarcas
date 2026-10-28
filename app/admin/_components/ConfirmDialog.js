'use client';
// Janela de confirmação com o visual do painel (no lugar do confirm() do navegador).
// Uso nas telas: const { ask } = useAdmin(); if (!(await ask({ title, message, confirmLabel, danger }))) return;
import { useCallback, useEffect, useRef, useState } from 'react';

export function useConfirm() {
  const [dialog, setDialog] = useState(null); // { title, message, confirmLabel, cancelLabel, danger, resolve }
  const ask = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);
  const close = (answer) => { dialog?.resolve(answer); setDialog(null); };
  const element = dialog ? <ConfirmDialog {...dialog} onAnswer={close} /> : null;
  return { ask, element };
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Voltar', danger, onAnswer }) {
  const ok = useRef(null);
  const answer = useRef(onAnswer);
  answer.current = onAnswer;
  useEffect(() => {
    const opener = document.activeElement; // ao fechar, o foco volta para o botão que abriu a janela
    ok.current?.focus();
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); answer.current(false); } };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); opener?.focus?.(); };
  }, []);
  return (
    <div className="confirm-wrap" onClick={(e) => { if (e.target === e.currentTarget) onAnswer(false); }}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-t" aria-describedby="confirm-m">
        <span className={`confirm-ic ${danger ? 'bad' : ''}`} aria-hidden="true">{danger ? '!' : '?'}</span>
        <h2 id="confirm-t">{title}</h2>
        {message && <p id="confirm-m">{message}</p>}
        <div className="confirm-actions">
          <button type="button" className="btn ghost" onClick={() => onAnswer(false)}>{cancelLabel}</button>
          <button type="button" ref={ok} className={`btn ${danger ? 'danger-solid' : 'solid'}`} onClick={() => onAnswer(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
