// Banco Postgres de teste em memória (PGlite) com o supabase/schema.sql aplicado.
// Simula só o que o Supabase traz pronto: papéis, auth.users, auth.uid() e o Storage.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const SCHEMA = fs.readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8')
  .replace(/create extension[^;]*;/, '') // gen_random_uuid já vem no Postgres
  .replace(/do \$\$ begin\s*alter publication[\s\S]*?end \$\$;/, ''); // Realtime não existe fora do Supabase

const SUPABASE = `
  create role anon; create role authenticated;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql as 'select null::uuid';
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (bucket_id text);
`;

// before: SQL rodado antes do schema (para simular um banco que já existia).
export async function createDb({ before = '' } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE);
  if (before) await db.exec(before);
  await db.exec(SCHEMA);
  return {
    db,
    applySchema: () => db.exec(SCHEMA),
    rows: async (sql, params) => (await db.query(sql, params)).rows,
    // Executa e devolve a mensagem de erro do banco, ou null se deu certo.
    error: async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { return e.message; } },
  };
}

// Cria um pedido com um item e devolve o id.
export async function createOrder(t, productId, size = 'Único', qty = 1, extra = {}) {
  const cols = { customer_name: 'Ana Lima', email: 'ana@exemplo.com', phone: '92999999999', cpf: '52998224725', shipping_option: 'parintins', shipping_label: 'Parintins', subtotal: 1, total: 1, payment_method: 'pix', ...extra };
  const keys = Object.keys(cols);
  const [o] = await t.rows(`insert into orders (${keys}) values (${keys.map((_, i) => `$${i + 1}`)}) returning id`, Object.values(cols));
  await t.rows('insert into order_items (order_id, product_id, name, brand, category, size, qty, unit_price) values ($1, $2, $3, $4, $5, $6, $7, 1)',
    [o.id, productId, 'peça', 'capodarte', 'bolsas', size, qty]);
  return o.id;
}
