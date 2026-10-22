'use client';
// Campo de etiquetas: digite e aperte Enter (usado em tamanhos).
import { useState } from 'react';

export default function Chips({ value, onChange, placeholder }) {
  const [t, setT] = useState('');
  const add = () => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setT(''); };
  return (
    <div className="chips">
      {value.map((v) => <span key={v}>{v}<button type="button" aria-label={`Remover ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button></span>)}
      <input value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onBlur={add}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)); }} />
    </div>
  );
}

