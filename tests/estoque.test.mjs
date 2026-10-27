// Reserva, devolução e alerta de estoque no banco (supabase/schema.sql).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, createOrder } from './helpers/db.mjs';

let t;
before(async () => { t = await createDb(); });

const newProduct = async (cols) => {
  const keys = Object.keys(cols);
  const [p] = await t.rows(`insert into products (${keys}) values (${keys.map((_, i) => `$${i + 1}`)}) returning id`, Object.values(cols));
  return p.id;
};
const bag = (stock) => newProduct({ name: 'Bolsa A', brand: 'capodarte', category: 'bolsas', price: 100, stock });
const shoe = (sizeStock) => newProduct({ name: 'Sandália B', brand: 'carmen', category: 'calcados', price: 200, sizes: Object.keys(sizeStock), size_stock: sizeStock });
const product = async (id) => (await t.rows('select stock, size_stock from products where id = $1', [id]))[0];
const order = async (id) => (await t.rows('select status, stock_reserved, stock_issue from orders where id = $1', [id]))[0];
const reserve = (id) => t.error('select reserve_stock($1)', [id]);
const setStatus = (id, s) => t.error('update orders set status = $2 where id = $1', [id, s]);

test('estoque por tamanho: a coluna stock guarda a soma', async () => {
  const id = await shoe({ 35: 2, 36: 1, 37: 0 });
  assert.equal((await product(id)).stock, 3);
});

test('só uma cliente leva a última unidade', async () => {
  const p = await bag(1);
  const o1 = await createOrder(t, p);
  const o2 = await createOrder(t, p);
  assert.equal(await reserve(o1), null);
  assert.equal((await product(p)).stock, 0);
  assert.match(await reserve(o2), /^ESTOQUE\|Bolsa A\|\|0/);
});

test('reservar o mesmo pedido duas vezes não baixa duas vezes', async () => {
  const p = await bag(2);
  const o = await createOrder(t, p);
  await reserve(o); await reserve(o);
  assert.equal((await product(p)).stock, 1);
});

test('cancelar devolve ao estoque uma única vez', async () => {
  const p = await bag(1);
  const o = await createOrder(t, p);
  await reserve(o);
  assert.equal(await setStatus(o, 'cancelled'), null);
  assert.equal((await product(p)).stock, 1);
  await setStatus(o, 'cancelled');
  assert.equal((await product(p)).stock, 1);
  assert.equal((await order(o)).stock_reserved, false);
});

test('reabrir pedido sem estoque é bloqueado', async () => {
  const p = await bag(0);
  const o = await createOrder(t, p, 'Único', 1, { status: 'cancelled' });
  assert.match(await setStatus(o, 'pending'), /ESTOQUE/);
});

test('pagamento atrasado de peça já vendida é aceito e gera alerta', async () => {
  const p = await bag(1);
  const late = await createOrder(t, p);
  await reserve(late);
  await setStatus(late, 'cancelled'); // PIX venceu, peça voltou
  const other = await createOrder(t, p);
  await reserve(other); // outra cliente levou
  assert.equal(await setStatus(late, 'paid'), null); // o pagamento atrasado chega
  const o = await order(late);
  assert.equal(o.status, 'paid');
  assert.equal(o.stock_issue, 'Bolsa A: faltou 1');
  assert.equal((await product(p)).stock, 0);
});

test('cancelar pedido com alerta não cria estoque fantasma', async () => {
  const p = await bag(0);
  const o = await createOrder(t, p, 'Único', 1, { status: 'cancelled' });
  await setStatus(o, 'paid');
  assert.ok((await order(o)).stock_issue);
  await setStatus(o, 'cancelled');
  assert.equal((await product(p)).stock, 0);
  assert.equal((await order(o)).stock_issue, null);
});

test('pagamento normal não gera alerta', async () => {
  const p = await bag(3);
  const o = await createOrder(t, p);
  await reserve(o);
  await setStatus(o, 'paid');
  assert.equal((await order(o)).stock_issue, null);
  assert.equal((await product(p)).stock, 2);
});

test('reembolso depois de enviado não devolve ao estoque', async () => {
  const p = await bag(1);
  const o = await createOrder(t, p);
  await reserve(o);
  for (const s of ['paid', 'shipped', 'refunded']) assert.equal(await setStatus(o, s), null);
  assert.equal((await product(p)).stock, 0);
});

test('reembolso de pedido pago (não enviado) devolve ao estoque', async () => {
  const p = await bag(1);
  const o = await createOrder(t, p);
  await reserve(o);
  await setStatus(o, 'paid'); await setStatus(o, 'refunded');
  assert.equal((await product(p)).stock, 1);
});

test('calçado: cada tamanho tem o seu estoque', async () => {
  const p = await shoe({ 35: 1, 36: 0 });
  const o35 = await createOrder(t, p, '35');
  assert.equal(await reserve(o35), null);
  const s = await product(p);
  assert.equal(s.size_stock['35'], 0);
  assert.equal(s.stock, 0);
  assert.match(await reserve(await createOrder(t, p, '36')), /^ESTOQUE\|Sandália B\|36\|0/);
  await setStatus(o35, 'cancelled');
  assert.equal((await product(p)).size_stock['35'], 1);
});

test('peça sem controle de estoque não é afetada', async () => {
  const p = await bag(null);
  const o = await createOrder(t, p, 'Único', 5);
  assert.equal(await reserve(o), null);
  assert.equal((await product(p)).stock, null);
});

test('rodar o schema de novo não muda pedidos nem estoque', async () => {
  const p = await bag(4);
  const o = await createOrder(t, p);
  await reserve(o);
  await t.applySchema();
  assert.equal((await product(p)).stock, 3);
  assert.equal((await order(o)).stock_reserved, true);
});

test('visitantes não podem chamar as funções do servidor', async () => {
  const g = await t.rows(`select routine_name, grantee from information_schema.role_routine_grants
    where routine_name in ('apply_stock', 'reserve_stock', 'rate_hit') and grantee in ('anon', 'authenticated', 'PUBLIC')`);
  assert.deepEqual(g, []);
});
