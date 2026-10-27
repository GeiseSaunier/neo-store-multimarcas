// Regra "Combine com" da loja (public/loja/js/look.js): qual calçado combina com cada bolsa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (f) => fs.readFileSync(new URL(`../public/loja/js/${f}`, import.meta.url), 'utf8');
// Carrega config.js + look.js como no navegador, com o catálogo P e o estoque (room) de teste.
function loadLook(P, stock = {}) {
  const room = (p, size) => stock[`${p.id}|${size}`] ?? stock[p.id] ?? 1;
  return new Function('P', 'room', `${read('config.js')}\n${read('look.js')}\nreturn { lookFor, colorDist, isNeutral, lookScore };`)(P, room);
}
const item = (id, c, cols, extra = {}) => ({ id, n: id, b: 'carmen', c, cols, p: 300, sizes: c === 'calcados' ? ['35', '36'] : ['Único'], out: false, ...extra });

test('cores: iguais = 0, preto x branco = quase 1', () => {
  const { colorDist } = loadLook([]);
  assert.equal(colorDist('#8A3F22', '#8A3F22'), 0);
  assert.ok(colorDist('#000000', '#FFFFFF') > 0.95);
  assert.ok(colorDist('#8A3F22', '#A0592C') < colorDist('#8A3F22', '#2E6FD8'));
  assert.equal(colorDist('', '#000000'), null);
});

test('tons neutros: preto, nude, caramelo e marrom sim; azul e verde não', () => {
  const { isNeutral } = loadLook([]);
  for (const c of ['#000000', '#FFFFFF', '#E8CDB5', '#A0592C', '#6B5444']) assert.equal(isNeutral(c), true, c);
  for (const c of ['#2E6FD8', '#2FA84F', '#D81B60']) assert.equal(isNeutral(c), false, c);
});

test('bolsa marrom: sugere primeiro o calçado de cor parecida', () => {
  const bag = item('bolsa-marrom', 'bolsas', ['#8A3F22']);
  const P = [bag, item('tenis-azul', 'calcados', ['#2E6FD8']), item('sandalia-conhaque', 'calcados', ['#9A4A28']), item('scarpin-verde', 'calcados', ['#2FA84F'])];
  const got = loadLook(P).lookFor(bag);
  assert.equal(got[0].id, 'sandalia-conhaque');
  assert.equal(got.length, 2); // no máximo 2 sugestões
});

test('calçado neutro (preto) combina com bolsa colorida melhor que outra cor forte', () => {
  const bag = item('bolsa-rosa', 'bolsas', ['#D81B60']);
  const P = [bag, item('tenis-verde', 'calcados', ['#2FA84F']), item('scarpin-preto', 'calcados', ['#111111'])];
  assert.equal(loadLook(P).lookFor(bag, 1)[0].id, 'scarpin-preto');
});

test('na dúvida de cor, prefere a mesma marca', () => {
  const bag = item('bolsa', 'bolsas', [''], { b: 'csclub' });
  const P = [bag, item('outra-marca', 'calcados', ['']), item('mesma-marca', 'calcados', [''], { b: 'csclub' })];
  assert.equal(loadLook(P).lookFor(bag, 1)[0].id, 'mesma-marca');
});

test('não sugere calçado esgotado nem para quem não é bolsa', () => {
  const bag = item('bolsa', 'bolsas', ['#000000']);
  const P = [bag, item('esgotado', 'calcados', ['#000000']), item('sem-tamanho', 'calcados', ['#000000']), item('ok', 'calcados', ['#333333'])];
  P[1].out = true;
  const look = loadLook(P, { 'sem-tamanho': 0 });
  assert.deepEqual(look.lookFor(bag).map((s) => s.id), ['ok']);
  assert.deepEqual(look.lookFor(item('carteira', 'carteiras', ['#000000'])), []);
  assert.deepEqual(look.lookFor(undefined), []);
});

test('sem nenhum calçado na loja, não aparece sugestão', () => {
  const bag = item('bolsa', 'bolsas', ['#000000']);
  assert.deepEqual(loadLook([bag]).lookFor(bag), []);
});
