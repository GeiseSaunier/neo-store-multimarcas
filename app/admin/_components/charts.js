'use client';
// Gráficos e indicadores usados na Visão geral.
import { brl } from '@/lib/format';

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
export function Delta({ now, before, className = '' }) {
  const d = pct(now, before);
  if (d === null) return <span className={className}>sem dados do mês anterior</span>;
  return <span className={`${className} ${d >= 0 ? 'up' : 'down'}`}>{d >= 0 ? '▲' : '▼'} {Math.abs(d)}% em relação ao mês anterior</span>;
}

export function DailyChart({ days }) {
  const W = 720, H = 220, P = { l: 44, r: 8, t: 12, b: 26 };
  // mínimo de R$ 100 no eixo: sem vendas, as marcas ficam 0, 50 e 100 (e não "1" repetido)
  const max = Math.max(100, ...days.map((d) => d.v));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const bw = (W - P.l - P.r) / days.length;
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / top);
  const ticks = [0, top / 2, top];
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Faturamento por dia do mês">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={P.l - 8} y={y(t) + 3} textAnchor="end">{t >= 1000 ? `${Math.round(t / 100) / 10}k` : Math.round(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const h = Math.max(0, H - P.b - y(d.v));
          const x = P.l + i * bw + bw * 0.18, w = bw * 0.64, r = Math.min(w / 2, h);
          return (
            <g key={i}>
              {d.v > 0 && <path className="bar" d={`M${x},${H - P.b} V${H - P.b - h + r} A${w / 2},${r} 0 0 1 ${x + w},${H - P.b - h + r} V${H - P.b} Z`}><title>{`Dia ${i + 1}: ${brl(d.v)} · ${d.n} ${d.n === 1 ? 'pedido' : 'pedidos'}`}</title></path>}
              {(i === 0 || (i + 1) % 5 === 0) && <text className="axis" x={x + w / 2} y={H - 8} textAnchor="middle">{i + 1}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>Sem vendas no período.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="r" key={r.k}><span>{r.k}</span><span>{brl(r.v)}</span><div className="track"><div className="fill" style={{ width: `${(r.v / max) * 100}%` }} /></div></div>
      ))}
    </div>
  );
}

