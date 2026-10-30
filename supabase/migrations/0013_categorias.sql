-- ============================================================
--  0013 — Categorías de menú como entidad propia por tenant.
--  Antes 'categoria' era texto libre en menu_items. Ahora hay una
--  tabla categorias (nombre + orden) y menu_items.categoria_id la
--  referencia. El FK (NO ACTION) bloquea borrar una categoría que
--  tenga productos. Se conserva la columna 'categoria' (texto) como
--  snapshot legacy. IDEMPOTENTE.
-- ============================================================

create table if not exists public.categorias (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  uuid        not null references public.tenants(id) on delete cascade,
  nombre     text        not null,
  orden      integer     not null default 0,
  creado_en  timestamptz not null default now()
);
create index if not exists idx_categorias_tenant on public.categorias(tenant_id, orden);
create unique index if not exists uniq_categorias_nombre on public.categorias(tenant_id, lower(nombre));

-- Backfill: una categoría por cada nombre distinto ya usado en menu_items.
insert into public.categorias (tenant_id, nombre, orden)
select tenant_id, categoria, (row_number() over (partition by tenant_id order by categoria)) - 1
from (
  select distinct tenant_id, categoria
  from public.menu_items
  where categoria is not null and categoria <> ''
) d
on conflict (tenant_id, lower(nombre)) do nothing;

-- FK en menu_items (NO ACTION: bloquea borrar categoría con productos,
-- pero permite el cascade al borrar el tenant porque se resuelve al final).
alter table public.menu_items add column if not exists categoria_id uuid references public.categorias(id);
create index if not exists idx_menu_items_categoria on public.menu_items(categoria_id);

update public.menu_items m
set categoria_id = c.id
from public.categorias c
where c.tenant_id = m.tenant_id
  and lower(c.nombre) = lower(m.categoria)
  and m.categoria_id is null;

-- RLS: lectura pública (el menú es público); escritura solo admin.
alter table public.categorias enable row level security;
drop policy if exists "categorias_public_read" on public.categorias;
drop policy if exists "categorias_admin_insert" on public.categorias;
drop policy if exists "categorias_admin_update" on public.categorias;
drop policy if exists "categorias_admin_delete" on public.categorias;

create policy "categorias_public_read" on public.categorias for select using (true);
create policy "categorias_admin_insert" on public.categorias for insert
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "categorias_admin_update" on public.categorias for update
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "categorias_admin_delete" on public.categorias for delete
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
