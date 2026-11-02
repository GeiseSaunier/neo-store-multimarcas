// Crediário: contas de pago/falta (lib/crediario.js) e regras das tabelas credit_sales / credit_payments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, today, fmtDay, saleSummary, receivedInMonth, creditError, publicStatement } from '../lib/crediario.js';
import { createDb } from './helpers/db.mjs';

test('valor digitado no jeito brasileiro', () => {
  assert.equal(parseMoney('1.234,56'), 1234.56);
  assert.equal(parseMoney('R$ 50'), 50);
  assert.equal(parseMoney('50,5'), 50.5);
  assert.equal(parseMoney('50.5'), 50.5);
  assert.equal(parseMoney('1.500'), 1500);
  for (const bad of ['', 'abc', '10,999', '-5', '1,2,3']) assert.ok(Number.isNaN(parseMoney(bad)), bad);
});

test('datas sem pular de dia por causa do fuso', () => {
  assert.equal(fmtDay('2026-11-02'), '02/11/2026');
  assert.equal(today(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

test('pago, falta e saldo depois de cada pagamento', () => {
  const sale = { total: 450, credit_payments: [
    { id: 'b', amount: 100.1, paid_on: '2026-10-20', created_at: '2' },
    { id: 'a', amount: 150, paid_on: '2026-10-01', created_at: '1' },
  ] };
  const s = saleSummary(sale);
  assert.equal(s.paid, 250.1);
  assert.equal(s.left, 199.9);
  assert.equal(s.settled, false);
  assert.equal(s.last.id, 'b');
  assert.deepEqual(s.history.map((p) => [p.id, p.left]), [['a', 300], ['b', 199.9]]);
});

test('venda quitada e venda sem pagamento', () => {
  assert.equal(saleSummary({ total: 0.3, credit_payments: [{ amount: 0.1, paid_on: '2026-10-01' }, { amount: 0.2, paid_on: '2026-10-02' }] }).settled, true);
  const none = saleSummary({ total: 90 });
  assert.deepEqual([none.paid, none.left, none.settled, none.last], [0, 90, false, null]);
});

test('recebido no mês soma só os pagamentos daquele mês', () => {
  const sales = [
    { total: 300, credit_payments: [{ amount: 50, paid_on: '2026-11-01' }, { amount: 70, paid_on: '2026-10-31' }] },
    { total: 100, credit_payments: [{ amount: 25.5, paid_on: '2026-11-30' }] },
  ];
  assert.equal(receivedInMonth(sales, '2026-11-02'), 75.5);
});

test('mensagem amigável para pagamento acima do que falta', () => {
  assert.match(creditError({ message: 'CREDIARIO_EXCEDE|120.00' }, 'x'), /R\$\s?120,00/);
  assert.equal(creditError({ message: 'outra coisa' }, 'padrão'), 'padrão');
});

test('banco: pagamentos não passam do valor da venda', async () => {
  const t = await createDb();
  const [s] = await t.rows("insert into credit_sales (customer_name, total, sold_on) values ('Maria', 300, '2026-11-01') returning id");
  assert.equal(await t.error('insert into credit_payments (sale_id, amount, paid_on) values ($1, 200, $2)', [s.id, '2026-11-01']), null);
  assert.match(await t.error('insert into credit_payments (sale_id, amount, paid_on) values ($1, 100.01, $2)', [s.id, '2026-11-02']), /CREDIARIO_EXCEDE\|100/);
  assert.equal(await t.error('insert into credit_payments (sale_id, amount, paid_on) values ($1, 100, $2)', [s.id, '2026-11-02']), null);
  // diminuir o valor da venda para menos do que já foi pago também é recusado
  assert.match(await t.error('update credit_sales set total = 250 where id = $1', [s.id]), /CREDIARIO_EXCEDE/);
  assert.equal(await t.error('update credit_sales set total = 400 where id = $1', [s.id]), null);
});

test('banco: valores inválidos e exclusão da venda leva os pagamentos', async () => {
  const t = await createDb();
  assert.ok(await t.error("insert into credit_sales (customer_name, total, sold_on) values ('  ', 10, '2026-11-01')"));
  assert.ok(await t.error("insert into credit_sales (customer_name, total, sold_on) values ('Ana', 0, '2026-11-01')"));
  const [s] = await t.rows("insert into credit_sales (customer_name, total, sold_on) values ('Ana', 10, '2026-11-01') returning id");
  assert.ok(await t.error('insert into credit_payments (sale_id, amount, paid_on) values ($1, 0, $2)', [s.id, '2026-11-01']));
  await t.rows('insert into credit_payments (sale_id, amount, paid_on) values ($1, 5, $2)', [s.id, '2026-11-01']);
  await t.rows('delete from credit_sales where id = $1', [s.id]);
  assert.deepEqual(await t.rows('select * from credit_payments'), []);
});

test('banco: schema roda de novo sem erro e só admin acessa o crediário', async () => {
  const t = await createDb();
  await t.applySchema();
  const pol = await t.rows("select tablename, qual from pg_policies where tablename in ('credit_sales','credit_payments') order by tablename");
  assert.equal(pol.length, 2);
  for (const p of pol) assert.match(p.qual, /is_admin\(\)/);
  const rls = await t.rows("select relname, relrowsecurity from pg_class where relname in ('credit_sales','credit_payments')");
  assert.ok(rls.every((r) => r.relrowsecurity));
});

test('extrato da cliente: só primeiro nome, valores e datas (nada interno)', () => {
  const st = publicStatement({
    customer_name: '  Maria da Silva ', phone: '92999999999', notes: 'cliente atrasa', description: 'Bolsa Monograma', sold_on: '2026-10-02', total: 450,
    credit_payments: [{ amount: '100.00', paid_on: '2026-10-20', note: 'PIX', created_at: '2' }, { amount: 150, paid_on: '2026-10-02', note: 'Entrada', created_at: '1' }],
  });
  assert.deepEqual(st, {
    first_name: 'Maria', description: 'Bolsa Monograma', sold_on: '2026-10-02', total: 450, paid: 250, left: 200, settled: false,
    payments: [{ amount: 150, paid_on: '2026-10-02', left: 300 }, { amount: 100, paid_on: '2026-10-20', left: 200 }],
  });
  assert.doesNotMatch(JSON.stringify(st), /9299|atrasa|PIX|Silva/);
});

test('banco: cada venda ganha um código de link único, que pode ser trocado', async () => {
  const t = await createDb();
  const [a] = await t.rows("insert into credit_sales (customer_name, total, sold_on) values ('Ana', 10, '2026-11-01') returning public_token");
  const [b] = await t.rows("insert into credit_sales (customer_name, total, sold_on) values ('Bia', 10, '2026-11-01') returning id, public_token");
  assert.match(a.public_token, /^[0-9a-f-]{36}$/);
  assert.notEqual(a.public_token, b.public_token);
  assert.ok(await t.error('update credit_sales set public_token = $1 where id = $2', [a.public_token, b.id]));
  // banco que já tinha vendas antes do link: o schema preenche as antigas
  const old = await createDb({ before: "create table public.credit_sales (id uuid primary key default gen_random_uuid(), customer_name text not null, phone text, description text not null default '', total numeric(10,2) not null, sold_on date not null, notes text, created_at timestamptz not null default now()); insert into public.credit_sales (customer_name, total, sold_on) values ('Cris', 50, '2026-10-01');" });
  const [c] = await old.rows('select public_token from credit_sales');
  assert.match(c.public_token, /^[0-9a-f-]{36}$/);
});
