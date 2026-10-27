// Leitor de texto formatado das páginas de informação (lib/markdown.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseMarkdown, parseInline, fillVars } from '../lib/markdown.js';

test('títulos, parágrafos e listas', () => {
  const md = '# Política\n\nPrimeiro parágrafo\ncontinua na linha de baixo.\n\n## Dados\n- um\n- dois\n  continuação do dois\n\n### Seção\n1. primeiro\n2) segundo\n';
  assert.deepEqual(parseMarkdown(md), [
    { type: 'h1', text: 'Política' },
    { type: 'p', text: 'Primeiro parágrafo continua na linha de baixo.' },
    { type: 'h2', text: 'Dados' },
    { type: 'ul', items: ['um', 'dois continuação do dois'] },
    { type: 'h3', text: 'Seção' },
    { type: 'ol', items: ['primeiro', 'segundo'] },
  ]);
});

test('texto colado do Windows ou do Word (CRLF e marcadores •)', () => {
  assert.deepEqual(parseMarkdown('Linha 1\r\n\r\n• item A\r\n• item B'), [
    { type: 'p', text: 'Linha 1' },
    { type: 'ul', items: ['item A', 'item B'] },
  ]);
});

test('negrito e links; links perigosos ficam como texto', () => {
  assert.deepEqual(parseInline('Veja **isto** e [a LGPD](https://www.planalto.gov.br/lei).'), [
    { type: 'text', text: 'Veja ' }, { type: 'bold', text: 'isto' }, { type: 'text', text: ' e ' },
    { type: 'link', text: 'a LGPD', href: 'https://www.planalto.gov.br/lei' }, { type: 'text', text: '.' },
  ]);
  assert.deepEqual(parseInline('[clique](javascript:alert(1))'), [{ type: 'text', text: '[clique](javascript:alert(1))' }]);
});

test('variáveis da loja; desconhecidas ou vazias ficam como estão', () => {
  assert.equal(fillVars('Fale {{contato}} · {{ email }} · {{nada}}', { contato: 'pelo WhatsApp', email: '' }), 'Fale pelo WhatsApp · {{ email }} · {{nada}}');
});

for (const file of ['privacidade.md', 'trocas.md']) test(`content/${file}: tem título e não sobra variável sem valor`, () => {
  const md = fs.readFileSync(new URL(`../content/${file}`, import.meta.url), 'utf8');
  const vars = { empresa: 'x', cnpj: 'x', cidades: 'x', whatsapp: 'x', email: 'x', banco: 'x', contato: 'x' };
  assert.equal(parseMarkdown(md)[0].type, 'h1');
  assert.doesNotMatch(fillVars(md, vars), /\{\{/);
});
