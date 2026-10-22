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

-- ---------- Baixa de estoque ao confirmar pagamento ----------
create or replace function public.decrement_stock(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.products p
     set stock = greatest(0, p.stock - i.qty)
    from (select product_id, sum(qty) qty from public.order_items where order_id = p_order group by product_id) i
   where p.id = i.product_id and p.stock is not null;
end; $$;
revoke execute on function public.decrement_stock(uuid) from anon, authenticated;

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

insert into public.coupons (code, percent) values ('NEO10',10),('BEMVINDA',10)
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
