// Marcas e categorias aceitas pelo banco (iguais a BRANDS e SUBS em lib/config.js).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './helpers/db.mjs';
import { BRANDS, SUBS, brandName } from '../lib/config.js';

let t;
before(async () => { t = await createDb(); });
const insert = (brand, category, brand_label = null) =>
  t.error('insert into products (name, brand, category, price, brand_label) values ($1, $2, $3, 100, $4)', ['Peça', brand, category, brand_label]);

test('banco aceita todas as marcas e categorias do config', async () => {
  for (const [brand, b] of Object.entries(BRANDS)) for (const cat of b.subs) assert.equal(await insert(brand, cat), null, `${brand}/${cat}`);
  assert.deepEqual(Object.keys(SUBS).sort(), ['bolsas', 'calcados', 'carteiras', 'roupas']);
});

test('banco recusa marca ou categoria desconhecida', async () => {
  assert.match(await insert('zara', 'bolsas'), /products_brand_check/);
  assert.match(await insert('csclub', 'oculos'), /products_category_check/);
});

test('roupa de marca avulsa guarda o nome da marca', async () => {
  assert.equal(await insert('outras', 'roupas', 'Lança Perfume'), null);
  const [p] = await t.rows(`select brand_label from products where brand = 'outras' order by created_at desc limit 1`);
  assert.equal(p.brand_label, 'Lança Perfume');
});

test('nome da marca exibido', () => {
  assert.equal(brandName('csclub'), 'Cs Club');
  assert.equal(brandName('outras', 'Lança Perfume'), 'Lança Perfume');
  assert.equal(brandName('outras', null), 'Outras marcas');
});

test('banco antigo (só Capodarte e Carmen) é atualizado ao rodar o schema', async () => {
  const old = await createDb({
    before: `create table public.products (id uuid primary key default gen_random_uuid(), name text not null,
      brand text not null check (brand in ('capodarte','carmen')), category text not null check (category in ('bolsas','carteiras','calcados')),
      price numeric(10,2) not null, old_price numeric(10,2), description text not null default '', details text[] not null default '{}',
      sizes text[] not null default '{Único}', colors text[] not null default '{}', images text[] not null default '{}', stock integer,
      active boolean not null default true, position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());`,
  });
  assert.equal(await old.error(`insert into products (name, brand, category, price) values ('Tênis', 'csclub', 'calcados', 300)`), null);
});
