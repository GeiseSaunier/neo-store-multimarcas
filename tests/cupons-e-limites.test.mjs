// Cupom de primeira compra (migração do banco) e limite de tentativas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './helpers/db.mjs';

const coupons = async (t) => t.rows('select code, percent::int, first_purchase from coupons order by code');

test('instalação nova cria só o BEMVINDA, válido na primeira compra', async () => {
  const t = await createDb();
  assert.deepEqual(await coupons(t), [{ code: 'BEMVINDA', percent: 10, first_purchase: true }]);
});

test('banco que já existia: BEMVINDA passa a valer só na primeira compra', async () => {
  const t = await createDb({
    before: `create table public.coupons (code text primary key, percent numeric(5,2) not null, active boolean not null default true, created_at timestamptz not null default now());
             insert into public.coupons (code, percent) values ('BEMVINDA', 10), ('NATAL', 15);`,
  });
  assert.deepEqual(await coupons(t), [
    { code: 'BEMVINDA', percent: 10, first_purchase: true },
    { code: 'NATAL', percent: 15, first_purchase: false },
  ]);
});

test('rodar o schema de novo respeita o que foi escolhido no painel', async () => {
  const t = await createDb();
  await t.rows(`update coupons set first_purchase = false where code = 'BEMVINDA'`);
  await t.applySchema();
  assert.equal((await coupons(t))[0].first_purchase, false);
});

test('rate_hit bloqueia depois do limite e libera quando a janela vence', async () => {
  const t = await createDb();
  const hit = async () => (await t.rows(`select rate_hit('checkout:1.2.3.4', 3, 600) as over`))[0].over;
  assert.deepEqual([await hit(), await hit(), await hit(), await hit()], [false, false, false, true]);
  // outro IP não é afetado
  assert.equal((await t.rows(`select rate_hit('checkout:5.6.7.8', 3, 600) as over`))[0].over, false);
  // janela vencida: a contagem recomeça
  await t.rows(`update rate_hits set reset_at = now() - interval '1 second' where key = 'checkout:1.2.3.4'`);
  assert.equal(await hit(), false);
});
