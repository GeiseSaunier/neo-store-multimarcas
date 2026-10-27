// Gera e baixa uma planilha CSV (abre no Excel e no Google Planilhas).
export function downloadCsv(filename, header, rows) {
  // Texto começando com = + - @ não pode virar fórmula ao abrir no Excel.
  const safe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v ?? ''));
  const esc = (v) => `"${safe(v).replace(/"/g, '""')}"`;
  const text = [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
