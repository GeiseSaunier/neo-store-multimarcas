// Promoções: preço do momento (lib/promo.js) e regras da tabela promotions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoStatus, promoPrice, bestPromo, applyPromo } from '../lib/promo.js';
import { createDb } from './helpers/db.mjs';

const NOW = new Date('2026-11-10T12:00:00Z');
const promo = (extra) => ({ id: 'p1', name: 'Black Friday', percent: 20, starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-11-15T23:59:00Z', active: true, product_ids: ['bolsa'], ...extra });
const bolsa = { id: 'bolsa', price: 690, old_price: null };

test('situação: agendada, ativa, pausada e encerrada', () => {
  assert.equal(promoStatus(promo({ starts_at: '2026-11-20T00:00:00Z', ends_at: '2026-11-30T00:00:00Z' }), NOW), 'scheduled');
  assert.equal(promoStatus(promo(), NOW), 'active');
  assert.equal(promoStatus(promo({ active: false }), NOW), 'paused');
  assert.equal(promoStatus(promo({ ends_at: '2026-11-09T00:00:00Z' }), NOW), 'ended');
  assert.equal(promoStatus(promo({ active: false, ends_at: '2026-11-09T00:00:00Z' }), NOW), 'ended');
});

test('início e fim exatos: começa na hora marcada e acaba na hora marcada', () => {
  const p = promo({ starts_at: NOW.toISOString(), ends_at: '2026-11-10T13:00:00Z' });
  assert.equal(promoStatus(p, NOW), 'active');
  assert.equal(promoStatus(p, new Date('2026-11-10T13:00:00Z')), 'ended');
});

test('preço com desconto em centavos certos', () => {
  assert.equal(promoPrice(690, 20), 552);
  assert.equal(promoPrice(459.9, 15), 390.92);
});

test('peça em promoção: preço com desconto e preço "de" riscado', () => {
  assert.deepEqual(applyPromo(bolsa, [promo()], NOW), { price: 552, old_price: 690, promo: { id: 'p1', name: 'Black Friday', percent: 20, ends_at: '2026-11-15T23:59:00Z' } });
  // com "preço de" cadastrado na peça, o riscado é o preço normal, para o −20% bater com a conta
  const p = applyPromo({ ...bolsa, old_price: 800 }, [promo()], NOW);
  assert.equal(p.old_price, 690);
  assert.equal(Math.round((1 - p.price / p.old_price) * 100), 20);
});

test('fora do período, pausada ou de outra peça: preço normal', () => {
  for (const p of [promo({ ends_at: '2026-11-09T00:00:00Z' }), promo({ active: false }), promo({ product_ids: ['outra'] })]) {
    assert.deepEqual(applyPromo(bolsa, [p], NOW), { price: 690, old_price: null, promo: null });
  }
});

test('duas promoções na mesma peça: vale a de maior desconto', () => {
  const best = bestPromo('bolsa', [promo({ id: 'a', percent: 10 }), promo({ id: 'b', percent: 25 }), promo({ id: 'c', percent: 40, active: false })], NOW);
  assert.equal(best.id, 'b');
});

test('banco: tabela de promoções recusa desconto inválido e fim antes do início', async () => {
  const t = await createDb();
  const ins = (percent, s, e) => t.error('insert into promotions (name, percent, starts_at, ends_at) values ($1, $2, $3, $4)', ['X', percent, s, e]);
  assert.equal(await ins(20, '2026-11-01', '2026-11-15'), null);
  assert.match(await ins(0, '2026-11-01', '2026-11-15'), /promotions_percent_check/);
  assert.match(await ins(100, '2026-11-01', '2026-11-15'), /promotions_percent_check/);
  assert.match(await ins(20, '2026-11-15', '2026-11-01'), /promotions_period_check/);
  const [p] = await t.rows(`select active, product_ids from promotions limit 1`);
  assert.deepEqual(p, { active: true, product_ids: [] });
});
