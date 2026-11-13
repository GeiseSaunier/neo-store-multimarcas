// Monta o texto da planilha CSV (separada por ";", abre no Excel e no Google Planilhas).
// comma: true escreve os números como dinheiro brasileiro (-30,00), que o Excel em português lê como número.
export function csvText(header, rows, { comma = false } = {}) {
  // Texto começando com = + - @ não pode virar fórmula ao abrir no Excel.
  const safe = (v) => {
    if (comma && typeof v === 'number') return v.toFixed(2).replace('.', ',');
    return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v ?? '');
  };
  const esc = (v) => `"${safe(v).replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
}

// Gera e baixa a planilha.
export function downloadCsv(filename, header, rows, opts) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csvText(header, rows, opts)], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
