-- =====================================================================
-- Neo Store Multimarcas · estrutura do banco de dados (Supabase)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Administradores ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Produtos ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null check (brand in ('capodarte','carmen')),
  category text not null check (category in ('bolsas','carteiras','calcados')),
  price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2),
  description text not null default '',
  details text[] not null default '{}',
  sizes text[] not null default '{Único}',
  colors text[] not null default '{}',
  images text[] not null default '{}',
  stock integer,                      -- vazio = não controlar estoque
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Opções de entrega regional (editáveis no painel) ----------
create table if not exists public.shipping_options (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  price_label text,                   -- ex.: "R$ 40 a R$ 60" ou "Consulte"
  to_confirm boolean not null default false, -- valor combinado depois pelo WhatsApp
  active boolean not null default true,
  position integer not null default 0
);

-- ---------- Cupons ----------
create table if not exists public.coupons (
  code text primary key,
  percent numeric(5,2) not null check (percent > 0 and percent <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Cupom que vale só na primeira compra de cada CPF (ex.: BEMVINDA).
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coupons' and column_name = 'first_purchase') then
    alter table public.coupons add column first_purchase boolean not null default false;
    update public.coupons set first_purchase = true where code = 'BEMVINDA';
  end if;
end $$;

-- ---------- Pedidos ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code bigint generated always as identity (start with 1001),
  status text not null default 'pending'
    check (status in ('pending','paid','shipped','delivered','cancelled','refunded')),
  customer_name text not null,
  email text not null,
  phone text not null,
  cpf text not null,
  address jsonb not null default '{}',
  shipping_option text not null,
  shipping_label text not null,
  shipping_cost numeric(10,2) not null default 0,
  shipping_to_confirm boolean not null default false,
  subtotal numeric(10,2) not null,
  discount numeric(10,2) not null default 0,
  pix_discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  coupon text,
  payment_method text not null check (payment_method in ('pix','card','boleto')),
  mp_payment_id text,
  mp_preference_id text,
  mp_status text,
  pix_qr text,
  pix_qr_base64 text,
  pix_expires_at timestamptz,
  tracking_code text,
  notes text,
  paid_at timestamptz,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_cpf_idx on public.orders (cpf);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  brand text not null,
  category text not null,
  size text,
  color text,
  qty integer not null check (qty > 0),
  unit_price numeric(10,2) not null,
  image text
);
create index if not exists order_items_order_idx on public.order_items (order_id);

-- ---------- Cadastro de novidades ----------
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','whatsapp')),
  contact text not null,
  created_at timestamptz not null default now(),
  unique (channel, contact)
);

-- ---------- updated_at automático ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ---------- Estoque ----------
-- Estoque por tamanho (calçados): {"35": 2, "36": 0}. Vazio = usa a coluna stock.
alter table public.products add column if not exists size_stock jsonb;
-- Indica se as peças do pedido já saíram do estoque (reservadas na criação do pedido).
alter table public.orders add column if not exists stock_reserved boolean not null default false;
-- Pedidos pagos antes desta versão já tinham baixado o estoque.
update public.orders set stock_reserved = true where status in ('paid','shipped','delivered') and not stock_reserved;
-- Peças que faltaram quando um pagamento chegou depois de a peça ter sido vendida para outra cliente.
-- Aparece como alerta no painel; vazio = tudo certo.
alter table public.orders add column if not exists stock_issue text;

-- Com estoque por tamanho, a coluna stock guarda a soma (para "Esgotado" e para o painel).
create or replace function public.products_sum_stock() returns trigger language plpgsql as $$
begin
  if jsonb_typeof(new.size_stock) = 'object' and new.size_stock <> '{}'::jsonb then
    select coalesce(sum(greatest(0, value::int)), 0) into new.stock from jsonb_each_text(new.size_stock);
  else
    new.size_stock := null;
  end if;
  return new;
end; $$;
drop trigger if exists products_sum_stock on public.products;
create trigger products_sum_stock before insert or update on public.products for each row execute function public.products_sum_stock();

-- Tira (p_dir = -1) ou devolve (p_dir = 1) as peças de um pedido.
-- Sem p_force, falha com 'ESTOQUE|nome|tamanho|disponível' se faltar peça.
-- Com p_force (pagamento confirmado), nunca falha: devolve a lista do que faltou, ou null.
drop function if exists public.apply_stock(uuid, int, boolean);
create function public.apply_stock(p_order uuid, p_dir int, p_force boolean) returns text
language plpgsql security definer set search_path = public as $$
declare r record; p record; avail int; missing text[] := '{}';
begin
  for r in select product_id, coalesce(size, 'Único') size, sum(qty)::int q from public.order_items
            where order_id = p_order and product_id is not null
            group by product_id, coalesce(size, 'Único') order by product_id loop
    select id, name, stock, size_stock into p from public.products where id = r.product_id for update;
    if not found then continue; end if;
    if p.size_stock is not null then
      avail := coalesce((p.size_stock ->> r.size)::int, 0);
      if p_dir < 0 and avail < r.q then
        if not p_force then raise exception 'ESTOQUE|%|%|%', p.name, r.size, avail; end if;
        missing := missing || format('%s (tam. %s): faltou %s', p.name, r.size, r.q - avail);
      end if;
      update public.products set size_stock = jsonb_set(size_stock, array[r.size], to_jsonb(greatest(0, avail + p_dir * r.q))) where id = p.id;
    elsif p.stock is not null then
      if p_dir < 0 and p.stock < r.q then
        if not p_force then raise exception 'ESTOQUE|%||%', p.name, p.stock; end if;
        missing := missing || format('%s: faltou %s', p.name, r.q - p.stock);
      end if;
      update public.products set stock = greatest(0, stock + p_dir * r.q) where id = p.id;
    end if;
  end loop;
  return nullif(array_to_string(missing, '; '), '');
end; $$;

-- Reserva o estoque de um pedido recém-criado (chamado pelo checkout).
create or replace function public.reserve_stock(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders where id = p_order and stock_reserved) then return; end if;
  perform public.apply_stock(p_order, -1, false);
  update public.orders set stock_reserved = true where id = p_order;
end; $$;

-- Mudança de status mexe no estoque sozinha, venha do painel, do Mercado Pago ou da expiração:
-- cancelado devolve as peças; reaberto ou pago volta a reservar (pagamento nunca é bloqueado).
create or replace function public.orders_stock_on_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('pending','paid') and not new.stock_reserved then
    new.stock_issue := public.apply_stock(new.id, -1, new.status = 'paid');
    new.stock_reserved := true;
  elsif new.stock_reserved and (new.status = 'cancelled' or (new.status = 'refunded' and old.status in ('pending','paid'))) then
    -- só devolve o que de fato saiu: com peça faltando, o estoque já tinha ficado em 0
    if new.stock_issue is null then perform public.apply_stock(new.id, 1, false); end if;
    new.stock_reserved := false;
    new.stock_issue := null;
  end if;
  return new;
end; $$;
drop trigger if exists orders_stock on public.orders;
create trigger orders_stock before update of status on public.orders for each row execute function public.orders_stock_on_status();

-- ---------- Limite de tentativas (checkout, cupons, frete, novidades) ----------
-- Guardado no banco para valer em todos os servidores da Vercel ao mesmo tempo.
create table if not exists public.rate_hits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);
alter table public.rate_hits enable row level security; -- sem regras: só o servidor (service_role) acessa

-- Conta mais uma tentativa e diz se passou do limite na janela de p_window segundos.
create or replace function public.rate_hit(p_key text, p_max int, p_window int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into public.rate_hits as h (key, count, reset_at) values (p_key, 1, now() + make_interval(secs => p_window))
  on conflict (key) do update set
    count = case when h.reset_at < now() then 1 else h.count + 1 end,
    reset_at = case when h.reset_at < now() then now() + make_interval(secs => p_window) else h.reset_at end
  returning h.count into c;
  return c > p_max;
end; $$;
revoke execute on function public.rate_hit(text, int, int) from public, anon, authenticated;

drop function if exists public.decrement_stock(uuid);
revoke execute on function public.apply_stock(uuid, int, boolean) from public, anon, authenticated;
revoke execute on function public.reserve_stock(uuid) from public, anon, authenticated;

-- ---------- Segurança (RLS) ----------
alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.shipping_options enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscribers enable row level security;

drop policy if exists "admins leem" on public.admins;
create policy "admins leem" on public.admins for select using (public.is_admin());

drop policy if exists "vitrine le produtos ativos" on public.products;
create policy "vitrine le produtos ativos" on public.products for select using (active or public.is_admin());
drop policy if exists "admin edita produtos" on public.products;
create policy "admin edita produtos" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vitrine le fretes" on public.shipping_options;
create policy "vitrine le fretes" on public.shipping_options for select using (active or public.is_admin());
drop policy if exists "admin edita fretes" on public.shipping_options;
create policy "admin edita fretes" on public.shipping_options for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin cupons" on public.coupons;
create policy "admin cupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin pedidos" on public.orders;
create policy "admin pedidos" on public.orders for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin itens" on public.order_items;
create policy "admin itens" on public.order_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin assinantes" on public.subscribers;
create policy "admin assinantes" on public.subscribers for all using (public.is_admin()) with check (public.is_admin());
-- Pedidos e cadastros são criados pelo servidor (chave service_role), que ignora o RLS.

-- ---------- Notificações em tempo real no painel ----------
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

-- ---------- Fotos dos produtos (Storage) ----------
insert into storage.buckets (id, name, public) values ('products','products', true)
on conflict (id) do nothing;

drop policy if exists "fotos publicas" on storage.objects;
create policy "fotos publicas" on storage.objects for select using (bucket_id = 'products');
drop policy if exists "admin envia fotos" on storage.objects;
create policy "admin envia fotos" on storage.objects for insert with check (bucket_id = 'products' and public.is_admin());
drop policy if exists "admin altera fotos" on storage.objects;
create policy "admin altera fotos" on storage.objects for update using (bucket_id = 'products' and public.is_admin());
drop policy if exists "admin apaga fotos" on storage.objects;
create policy "admin apaga fotos" on storage.objects for delete using (bucket_id = 'products' and public.is_admin());

-- =====================================================================
-- Dados iniciais
-- =====================================================================
insert into public.shipping_options (id, name, description, price, price_label, to_confirm, position) values
  ('parintins','Parintins','Entrega no mesmo dia',0,'Consulte',true,1),
  ('maues','Maués','Envio pelo barco',20,null,false,2),
  ('manaus','Manaus','Barco + motoboy até a sua casa · cerca de 2 dias úteis · valor conforme o bairro',40,'R$ 40 a R$ 60',false,3),
  ('barco','Entrega no barco, rodoviária ou táxi','Outros municípios · combinamos os dados pelo WhatsApp',20,null,false,4)
on conflict (id) do nothing;

-- Cupom de boas-vindas: vale só na primeira compra de cada CPF.
insert into public.coupons (code, percent, first_purchase) values ('BEMVINDA',10,true)
on conflict (code) do nothing;

insert into public.products (name, brand, category, price, description, details, colors, images, position)
select * from (values
  ('Bolsa Estruturada Marrom','capodarte','bolsas',690.00,'Tote estruturada em tom conhaque com matelassê em losangos e trevos em relevo. O pingente de cadeado dourado finaliza com elegância.',array['Alças de ombro','Pingente de cadeado dourado','Relevo matelassê com trevos'],array['#8A3F22'],array['/seed/marrom.jpg'],1),
  ('Bolsa Monograma','capodarte','bolsas',790.00,'Bolsa de mão com base em tecido monograma e parte superior caramelo, com aplicação de trevo vazado. Acompanha chaveiro de pompom.',array['Alças de mão','Aplicação de trevo vazado','Chaveiro de pompom'],array['#A0592C'],array['/seed/monograma.jpg'],2),
  ('Bolsa Estruturada Preta','capodarte','bolsas',690.00,'A versão preta da nossa tote estruturada: matelassê em losangos, trevos em relevo e pingente de cadeado dourado. Combina com tudo.',array['Alças de ombro','Pingente de cadeado dourado','Relevo matelassê com trevos'],array['#1F1B19'],array['/seed/preta.jpg'],3),
  ('Bolsa Grande Shopper','capodarte','bolsas',990.00,'Shopper espaçosa em monograma, com faixa lateral e alças em caramelo e trevo aplicado. Leva o notebook, a necessaire e o dia inteiro.',array['Fechamento com zíper','Alças de ombro','Detalhes em caramelo'],array['#6B5444'],array['/seed/shopper.jpg'],4),
  ('Mala de Mão Monograma','capodarte','bolsas',990.00,'Mala de mão em monograma com bolso frontal e alças de mão. Encaixa na alça da mala de rodinhas para viajar com as mãos livres.',array['Bolso frontal com zíper','Alças de mão','Encaixe para mala de rodinhas'],array['#6B5444'],array['/seed/mala.jpg'],5),
  ('Necessaire Monograma','capodarte','bolsas',350.00,'Necessaire em monograma com zíper dourado e trevo metálico aplicado. Prática para a bolsa do dia a dia ou para viagem.',array['Fechamento com zíper','Trevo metálico dourado','Ideal para viagem'],array['#8C7560'],array['/seed/necessaire.jpg'],6)
) as v(name, brand, category, price, description, details, colors, images, position)
where not exists (select 1 from public.products);
