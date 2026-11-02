// Custo e lucro: divisão dos descontos por peça (lib/lucro.js), relatório e regras do banco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateNet, itemsRevenue, profitReport } from '../lib/lucro.js';
import { createDb } from './helpers/db.mjs';

const sum = (a) => Math.round(a.reduce((s, v) => s + v * 100, 0)) / 100;

test('cupom só sai das peças fora de promoção', () => {
  const nets = allocateNet([{ unit_price: 100, qty: 1, promo: false }, { unit_price: 200, qty: 1, promo: true }], { discount: 10 });
  assert.deepEqual(nets, [90, 200]);
});

test('desconto PIX: só a parte das peças sai do vendido (a do frete não)', () => {
  // peças 300 − cupom 30 = 270; frete 30; base 300; PIX 5% = 15 → peças levam 13,50
  const nets = allocateNet([{ unit_price: 100, qty: 3, promo: false }], { discount: 30, pixDiscount: 15, shipping: 30 });
  assert.deepEqual(nets, [256.5]);
});

test('centavos nunca se perdem na divisão', () => {
  const lines = [{ unit_price: 33.33, qty: 1 }, { unit_price: 33.33, qty: 1 }, { unit_price: 33.34, qty: 1 }].map((l) => ({ ...l, promo: false }));
  const nets = allocateNet(lines, { discount: 10, pixDiscount: 4.5 });
  assert.equal(sum(nets), 85.5);
  for (const n of nets) assert.equal(Math.round(n * 100), n * 100);
});

test('pedido antigo (sem valor líquido gravado): descontos na proporção do valor', () => {
  const order = { discount: 20, pix_discount: 0, shipping_cost: 0, order_items: [{ unit_price: 150, qty: 1 }, { unit_price: 50, qty: 1 }] };
  assert.deepEqual(itemsRevenue(order), [135, 45]);
  const novo = { ...order, order_items: order.order_items.map((i, k) => ({ ...i, net_amount: k ? 50 : 130 })) };
  assert.deepEqual(itemsRevenue(novo), [130, 50]);
});

test('relatório: junta site e fora do site por peça, com custo do dia ou o atual', () => {
  const r = profitReport({
    orders: [{ discount: 0, pix_discount: 0, shipping_cost: 0, order_items: [
      { product_id: 'bolsa', name: 'Bolsa', qty: 2, unit_price: 790, net_amount: 1580, unit_cost: 380 },
      { product_id: 'nec', name: 'Necessaire', qty: 1, unit_price: 350, net_amount: 350, unit_cost: null },
    ] }],
    manual: [
      { product_id: 'bolsa', name: 'Bolsa', qty: 1, unit_price: 700, unit_cost: 400, channel: 'loja' },
      { product_id: null, name: 'Cinto', qty: 1, unit_price: 90, unit_cost: null, channel: 'whatsapp' },
    ],
    costs: { bolsa: 999, nec: 120 },
  });
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  // custo guardado na venda vale mais que o atual (999)
  assert.deepEqual([by.Bolsa.qty, by.Bolsa.revenue, by.Bolsa.cost, by.Bolsa.profit], [3, 2280, 1160, 1120]);
  assert.deepEqual(by.Bolsa.byChannel, { site: 2, loja: 1 });
  assert.equal(by.Necessaire.cost, 120); // sem custo na venda: usa o atual
  assert.deepEqual([by.Cinto.noCostQty, by.Cinto.margin], [1, null]);
  // venda sem custo não vira lucro: entra no vendido, fica fora do lucro e da margem
  assert.equal(r.totals.revenue, 2720);
  assert.equal(r.totals.profit, 2280 + 350 - 1160 - 120);
  assert.equal(r.totals.noCostRevenue, 90);
  assert.equal(Math.round(r.totals.margin * 1000), Math.round(((2630 - 1280) / 2630) * 1000));
});

async function setup() {
  const t = await createDb();
  const [p] = await t.rows("insert into products (name, brand, category, price, stock) values ('Bolsa', 'capodarte', 'bolsas', 790, 3) returning id");
  const [s] = await t.rows(`insert into products (name, brand, category, price, sizes, size_stock) values ('Sandália', 'carmen', 'calcados', 300, '{35,36}', '{"35": 1, "36": 2}') returning id`);
  return { t, p: p.id, s: s.id };
}
const stock = async (t, id) => (await t.rows('select stock, size_stock from products where id = $1', [id]))[0];

test('banco: item do pedido guarda o custo do dia', async () => {
  const { t, p } = await setup();
  await t.rows('insert into product_costs (product_id, cost) values ($1, 380)', [p]);
  const [o] = await t.rows("insert into orders (customer_name, email, phone, cpf, shipping_option, shipping_label, subtotal, total, payment_method) values ('Ana', 'a@a.com', '92999999999', '52998224725', 'parintins', 'Parintins', 790, 790, 'pix') returning id");
  await t.rows("insert into order_items (order_id, product_id, name, brand, category, qty, unit_price, net_amount) values ($1, $2, 'Bolsa', 'capodarte', 'bolsas', 1, 790, 750.5)", [o.id, p]);
  await t.rows('update product_costs set cost = 999 where product_id = $1', [p]);
  const [it] = await t.rows('select unit_cost, net_amount from order_items');
  assert.deepEqual([Number(it.unit_cost), Number(it.net_amount)], [380, 750.5]);
});

test('banco: venda fora do site baixa o estoque e devolve ao excluir', async () => {
  const { t, p, s } = await setup();
  await t.rows('insert into product_costs (product_id, cost) values ($1, 380)', [p]);
  const [v] = await t.rows("insert into manual_sales (product_id, name, qty, unit_price, sold_on) values ($1, 'Bolsa', 2, 700, '2026-11-02') returning id, stock_taken, unit_cost", [p]);
  assert.deepEqual([v.stock_taken, Number(v.unit_cost)], [2, 380]);
  assert.equal((await stock(t, p)).stock, 1);
  // tamanho: só mexe no tamanho vendido
  const [vs] = await t.rows("insert into manual_sales (product_id, name, size, qty, unit_price, sold_on) values ($1, 'Sandália', '36', 1, 300, '2026-11-02') returning id", [s]);
  assert.deepEqual((await stock(t, s)).size_stock, { 35: 1, 36: 1 });
  await t.rows('delete from manual_sales where id = $1', [vs.id]);
  assert.deepEqual((await stock(t, s)).size_stock, { 35: 1, 36: 2 });
  await t.rows('delete from manual_sales where id = $1', [v.id]);
  assert.equal((await stock(t, p)).stock, 3);
});

test('banco: vender mais do que há no estoque não deixa negativo nem inventa peça ao excluir', async () => {
  const { t, p } = await setup();
  const [v] = await t.rows("insert into manual_sales (product_id, name, qty, unit_price, sold_on) values ($1, 'Bolsa', 5, 700, '2026-11-02') returning id, stock_taken", [p]);
  assert.equal(v.stock_taken, 3);
  assert.equal((await stock(t, p)).stock, 0);
  await t.rows('delete from manual_sales where id = $1', [v.id]);
  assert.equal((await stock(t, p)).stock, 3);
});

test('banco: peça fora do catálogo, sem estoque controlado, e venda que não muda de peça', async () => {
  const { t, p } = await setup();
  const [off] = await t.rows("insert into manual_sales (name, qty, unit_price, unit_cost, channel, sold_on) values ('Cinto', 1, 90, 40, 'whatsapp', '2026-11-02') returning stock_taken");
  assert.equal(off.stock_taken, 0);
  assert.ok(await t.error("insert into manual_sales (name, qty, unit_price, channel, sold_on) values ('X', 1, 1, 'feira', '2026-11-02')"));
  const [v] = await t.rows("insert into manual_sales (product_id, name, qty, unit_price, sold_on) values ($1, 'Bolsa', 1, 700, '2026-11-02') returning id", [p]);
  assert.match(await t.error('update manual_sales set qty = 2 where id = $1', [v.id]), /VENDA_FIXA/);
  assert.equal(await t.error("update manual_sales set unit_price = 650, notes = 'ok' where id = $1", [v.id]), null);
});

test('banco: custos e vendas manuais só para admin; schema roda de novo', async () => {
  const { t } = await setup();
  await t.applySchema();
  const pol = await t.rows("select tablename, qual from pg_policies where tablename in ('product_costs','manual_sales')");
  assert.equal(pol.length, 2);
  for (const x of pol) assert.match(x.qual, /is_admin\(\)/);
  // o custo não fica na tabela que a vitrine lê
  assert.deepEqual(await t.rows("select 1 from information_schema.columns where table_name = 'products' and column_name ilike '%cost%'"), []);
});

test('relatório: comprei, vendi, lucro e o que está parado no estoque', () => {
  const products = [
    { id: 'bolsa', name: 'Bolsa Monograma', stock: 1, size_stock: null },
    { id: 'nec', name: 'Necessaire', stock: null, size_stock: null }, // não controla estoque
    { id: 'parada', name: 'Sem movimento', stock: null, size_stock: null },
  ];
  const r = profitReport({
    products, costs: { bolsa: 380, nec: 120 },
    purchases: [
      { purchase_items: [{ product_id: 'bolsa', name: 'Bolsa Monograma', qty: 3, unit_cost: 380 }, { product_id: 'nec', name: 'Necessaire', qty: 5, unit_cost: 120 }] },
      { purchase_items: [{ product_id: null, name: 'Cinto', qty: 2, unit_cost: 40 }] },
    ],
    orders: [{ discount: 0, pix_discount: 0, shipping_cost: 0, order_items: [{ product_id: 'bolsa', name: 'Bolsa Monograma', qty: 2, unit_price: 790, net_amount: 1580, unit_cost: 380 }] }],
    manual: [{ product_id: 'nec', name: 'Necessaire', qty: 5, unit_price: 350, unit_cost: 120, channel: 'loja' }, { product_id: null, name: 'cinto ', qty: 1, unit_price: 90, unit_cost: 40, channel: 'whatsapp' }],
  });
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x]));
  assert.deepEqual([by['Bolsa Monograma'].boughtQty, by['Bolsa Monograma'].boughtCost, by['Bolsa Monograma'].revenue, by['Bolsa Monograma'].profit, by['Bolsa Monograma'].stock, by['Bolsa Monograma'].stockValue], [3, 1140, 1580, 820, 1, 380]);
  assert.deepEqual([by.Necessaire.profit, by.Necessaire.stock], [1150, 0]); // sem controle: comprado − vendido
  // peça fora do catálogo: compra e venda se juntam pelo nome
  assert.deepEqual([by.Cinto.boughtQty, by.Cinto.qty, by.Cinto.stock, by.Cinto.stockValue, by.Cinto.profit], [2, 1, 1, 40, 50]);
  assert.equal(by['Sem movimento'], undefined); // sem compra, venda nem estoque: fora da lista
  assert.deepEqual([r.totals.boughtCost, r.totals.revenue, r.totals.profit, r.totals.stock, r.totals.stockValue], [1140 + 600 + 80, 1580 + 1750 + 90, 820 + 1150 + 50, 2, 420]);
});

test('banco: compra soma ao estoque, vira o custo da peça e devolve ao excluir', async () => {
  const { t, p, s } = await setup();
  const [pu] = await t.rows("insert into purchases (supplier, bought_on) values ('Capodarte', '2026-11-02') returning id");
  await t.rows("insert into purchase_items (purchase_id, product_id, name, qty, unit_cost) values ($1, $2, 'Bolsa', 2, 380)", [pu.id, p]);
  await t.rows("insert into purchase_items (purchase_id, product_id, name, size, qty, unit_cost) values ($1, $2, 'Sandália', '35', 4, 150)", [pu.id, s]);
  assert.equal((await stock(t, p)).stock, 5);
  assert.deepEqual((await stock(t, s)).size_stock, { 35: 5, 36: 2 });
  assert.equal(Number((await t.rows('select cost from product_costs where product_id = $1', [p]))[0].cost), 380);
  // a venda seguinte guarda esse custo
  const [v] = await t.rows("insert into manual_sales (product_id, name, qty, unit_price, sold_on) values ($1, 'Bolsa', 4, 700, '2026-11-03') returning unit_cost", [p]);
  assert.equal(Number(v.unit_cost), 380);
  assert.equal((await stock(t, p)).stock, 1);
  // excluir a compra tira o que entrou, sem deixar negativo (já tinham saído 4 de 5)
  await t.rows('delete from purchases where id = $1', [pu.id]);
  assert.equal((await stock(t, p)).stock, 0);
  assert.deepEqual((await stock(t, s)).size_stock, { 35: 1, 36: 2 });
  assert.deepEqual(await t.rows('select * from purchase_items'), []);
});

test('banco: compra de peça sem controle de estoque ou fora do catálogo não mexe no estoque', async () => {
  const { t } = await setup();
  const [n] = await t.rows("insert into products (name, brand, category, price) values ('Livre', 'capodarte', 'bolsas', 100) returning id");
  const [pu] = await t.rows("insert into purchases (bought_on) values ('2026-11-02') returning id");
  const [a] = await t.rows("insert into purchase_items (purchase_id, product_id, name, qty, unit_cost) values ($1, $2, 'Livre', 3, 50) returning id, stock_added", [pu.id, n.id]);
  const [b] = await t.rows("insert into purchase_items (purchase_id, name, qty, unit_cost) values ($1, 'Cinto', 2, 40) returning stock_added", [pu.id]);
  assert.deepEqual([a.stock_added, b.stock_added], [0, 0]);
  assert.equal((await stock(t, n.id)).stock, null);
  assert.match(await t.error('update purchase_items set qty = 9 where id = $1', [a.id]), /COMPRA_FIXA/);
  assert.ok(await t.error("insert into purchase_items (purchase_id, name, qty, unit_cost) values ($1, 'X', 0, 1)", [pu.id]));
});

test('banco: compras só para admin', async () => {
  const { t } = await setup();
  const pol = await t.rows("select qual from pg_policies where tablename in ('purchases','purchase_items')");
  assert.equal(pol.length, 2);
  for (const x of pol) assert.match(x.qual, /is_admin\(\)/);
});

test('banco: peça com compra e venda lançadas pode ser excluída (o histórico fica com o nome)', async () => {
  const { t, p } = await setup();
  const [pu] = await t.rows("insert into purchases (bought_on) values ('2026-11-02') returning id");
  await t.rows("insert into purchase_items (purchase_id, product_id, name, qty, unit_cost) values ($1, $2, 'Bolsa', 2, 380)", [pu.id, p]);
  await t.rows("insert into manual_sales (product_id, name, qty, unit_price, sold_on) values ($1, 'Bolsa', 1, 700, '2026-11-03')", [p]);
  assert.equal(await t.error('delete from products where id = $1', [p]), null);
  assert.deepEqual(await t.rows('select product_id, name from purchase_items'), [{ product_id: null, name: 'Bolsa' }]);
  assert.deepEqual(await t.rows('select product_id, name from manual_sales'), [{ product_id: null, name: 'Bolsa' }]);
  // trocar uma venda para outra peça continua proibido
  const [o] = await t.rows("insert into products (name, brand, category, price) values ('Outra', 'capodarte', 'bolsas', 1) returning id");
  const [v] = await t.rows("insert into manual_sales (name, qty, unit_price, sold_on) values ('Avulsa', 1, 1, '2026-11-03') returning id");
  assert.match(await t.error('update manual_sales set product_id = $1 where id = $2', [o.id, v.id]), /VENDA_FIXA/);
});
