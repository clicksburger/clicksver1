-- ============================================================
--  CLICKS SAAS v3 — Schema inicial (IDEMPOTENTE)
--  Seguro de correr sobre una base limpia o sobre el esquema legacy.
--  No borra datos existentes (tenants, pedidos, menu_items).
-- ============================================================

create extension if not exists "pgcrypto";

-- ── TENANTS (solo se crea si no existe) ──────────────────────
create table if not exists public.tenants (
  id              uuid        primary key default gen_random_uuid(),
  slug            text        unique not null,
  nombre          text        not null,
  color_primario  text        not null default '#F5A300',
  color_fondo     text        not null default '#0f0f0f',
  color_surface   text        not null default '#1a1a1a',
  color_texto     text        not null default '#f0f0f0',
  logo_url        text,
  activo          boolean     not null default true,
  creado_en       timestamptz not null default now()
);
-- Por si viene de v1/v2 sin colores extendidos:
alter table public.tenants add column if not exists color_surface text not null default '#1a1a1a';
alter table public.tenants add column if not exists color_texto   text not null default '#f0f0f0';

-- ── ENUM de roles ────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'rol_staff') then
    create type public.rol_staff as enum ('admin', 'cajero', 'cocina');
  end if;
end $$;

-- ── PLATFORM ADMINS ──────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  creado_en  timestamptz not null default now()
);

-- ── MEMBERSHIPS (usuario ↔ tenant ↔ rol) ─────────────────────
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  rol        public.rol_staff not null default 'cajero',
  creado_en  timestamptz not null default now(),
  unique (user_id, tenant_id)
);
create index if not exists idx_memberships_user   on public.memberships(user_id);
create index if not exists idx_memberships_tenant on public.memberships(tenant_id);

-- ── MENU ITEMS (solo se crea si no existe) ───────────────────
create table if not exists public.menu_items (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  nombre       text        not null,
  descripcion  text,
  precio       numeric(10,2),
  categoria    text        not null default 'Principal',
  imagen_url   text,
  activo       boolean     not null default true,
  orden        integer     not null default 0,
  creado_en    timestamptz not null default now()
);
create index if not exists idx_menu_items_tenant on public.menu_items(tenant_id, activo, orden);

-- ── MENU VARIANTS ────────────────────────────────────────────
create table if not exists public.menu_variants (
  id            uuid        primary key default gen_random_uuid(),
  menu_item_id  uuid        not null references public.menu_items(id) on delete cascade,
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  label         text        not null,
  precio        numeric(10,2) not null,
  orden         integer     not null default 0,
  creado_en     timestamptz not null default now()
);
create index if not exists idx_menu_variants_item on public.menu_variants(menu_item_id, orden);

-- ── PEDIDOS (solo se crea si no existe) ──────────────────────
create table if not exists public.pedidos (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        uuid        not null references public.tenants(id) on delete cascade,
  num              integer     not null,
  estado           text        not null default 'nuevo',
  tipo             text        not null default 'delivery',
  nombre           text,
  items            jsonb       not null default '[]',
  demora           integer,
  hora_confirmado  timestamptz,
  hora_entregado   timestamptz,
  creado_en        timestamptz not null default now(),
  unique (tenant_id, num)
);
-- Sobre esquema legacy: agregar la columna nueva.
alter table public.pedidos add column if not exists tipo text not null default 'delivery';
create index if not exists idx_pedidos_tenant_estado on public.pedidos(tenant_id, estado);
create index if not exists idx_pedidos_tenant_creado on public.pedidos(tenant_id, creado_en desc);

-- ── FUNCIÓN: siguiente número de pedido por tenant ───────────
create or replace function public.next_pedido_num(p_tenant_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_max integer;
begin
  select coalesce(max(num), 0) + 1 into v_max from public.pedidos where tenant_id = p_tenant_id;
  return v_max;
end; $$;

-- ── REALTIME (solo si no está ya en la publicación) ──────────
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;
