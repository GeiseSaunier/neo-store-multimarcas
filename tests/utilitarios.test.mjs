// Funções puras do servidor e do painel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCpf, round2 } from '../lib/format.js';
import { stockMessage } from '../lib/orders.js';
import { csvText } from '../lib/csv.js';
import { tooManyInMemory, clientIp } from '../lib/ratelimit.js';

test('CPF: aceita válido, com ou sem pontuação', () => {
  assert.equal(validCpf('529.982.247-25'), true);
  assert.equal(validCpf('52998224725'), true);
});

test('CPF: recusa dígito errado, repetido ou incompleto', () => {
  for (const c of ['52998224724', '111.111.111-11', '1234567890', '', null]) assert.equal(validCpf(c), false, String(c));
});

test('round2 arredonda centavos', () => {
  assert.equal(round2(10.005 + 0.1), 10.11);
  assert.equal(round2(655.5 * 0.95), 622.73);
});

test('mensagem de estoque para a cliente', () => {
  assert.equal(stockMessage({ message: 'ESTOQUE|Bolsa A||0' }), 'Bolsa A acabou de esgotar. Atualize a página.');
  assert.equal(stockMessage({ message: 'ESTOQUE|Bolsa A||2' }), 'Temos só 2 unidade(s) de Bolsa A.');
  assert.equal(stockMessage({ message: 'ESTOQUE|Sandália|36|1' }), 'Temos só 1 unidade(s) de Sandália no tamanho 36.');
  assert.equal(stockMessage({ message: 'outro erro' }), null);
});

test('planilha: texto que vira fórmula no Excel é neutralizado', () => {
  const csv = csvText(['Nome', 'Telefone', 'Total'], [['=HYPERLINK("x")', '92999999999', 12.5], ['+55 92', '-1', 0], ['@soma', 'Ana "Lu"', null]]);
  assert.equal(csv, [
    '"Nome";"Telefone";"Total"',
    `"'=HYPERLINK(""x"")";"92999999999";"12.5"`,
    `"'+55 92";"'-1";"0"`,
    `"'@soma";"Ana ""Lu""";""`,
  ].join('\n'));
});

test('limite em memória (reserva quando o banco falha)', () => {
  const k = `teste:${Math.random()}`;
  const r = [1, 2, 3].map(() => tooManyInMemory(k, 2, 1000, 0));
  assert.deepEqual(r, [false, false, true]);
  assert.equal(tooManyInMemory(k, 2, 1000, 5000), false); // janela passou
});

test('IP da cliente vem dos cabeçalhos da Vercel', () => {
  assert.equal(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '1.1.1.1, 10.0.0.1' } })), '1.1.1.1');
  assert.equal(clientIp(new Request('http://x', { headers: { 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '1.1.1.1' } })), '2.2.2.2');
});
