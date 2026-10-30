-- ============================================================
--  RLS — Aislamiento multi-tenant (IDEMPOTENTE)
--  Reemplaza las políticas legacy "service only" (USING false).
--  El server legacy (Express) usa la service key y SIGUE funcionando
--  porque la service key saltea RLS.
-- ============================================================

-- ── HELPERS ──────────────────────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where user_id = auth.uid() and tenant_id = p_tenant_id);
$$;

create or replace function public.has_role(p_tenant_id uuid, p_roles public.rol_staff[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and tenant_id = p_tenant_id and rol = any(p_roles)
  );
$$;

-- ── ENABLE RLS ───────────────────────────────────────────────
alter table public.tenants         enable row level security;
alter table public.memberships     enable row level security;
alter table public.platform_admins enable row level security;
alter table public.menu_items      enable row level security;
alter table public.menu_variants   enable row level security;
alter table public.pedidos         enable row level security;

-- ── LIMPIAR POLÍTICAS PREVIAS (legacy + re-runs) ─────────────
drop policy if exists "service only" on public.tenants;
drop policy if exists "service only" on public.pedidos;
drop policy if exists "service only" on public.menu_items;
drop policy if exists "tenants_public_read"        on public.tenants;
drop policy if exists "tenants_admin_update"       on public.tenants;
drop policy if exists "tenants_platform_insert"    on public.tenants;
drop policy if exists "tenants_platform_delete"    on public.tenants;
drop policy if exists "memberships_self_read"      on public.memberships;
drop policy if exists "memberships_admin_write"    on public.memberships;
drop policy if exists "platform_admins_self_read"  on public.platform_admins;
drop policy if exists "menu_items_public_read"     on public.menu_items;
drop policy if exists "menu_items_admin_write"     on public.menu_items;
drop policy if exists "menu_variants_public_read"  on public.menu_variants;
drop policy if exists "menu_variants_admin_write"  on public.menu_variants;
drop policy if exists "pedidos_public_insert"      on public.pedidos;
drop policy if exists "pedidos_member_read"        on public.pedidos;
drop policy if exists "pedidos_member_update"      on public.pedidos;
drop policy if exists "pedidos_member_delete"      on public.pedidos;

-- ── TENANTS ──────────────────────────────────────────────────
create policy "tenants_public_read" on public.tenants
  for select using (activo = true or is_member(id) or is_platform_admin());
create policy "tenants_admin_update" on public.tenants
  for update using (has_role(id, array['admin']::public.rol_staff[]) or is_platform_admin());
create policy "tenants_platform_insert" on public.tenants
  for insert with check (is_platform_admin());
create policy "tenants_platform_delete" on public.tenants
  for delete using (is_platform_admin());

-- ── MEMBERSHIPS ──────────────────────────────────────────────
create policy "memberships_self_read" on public.memberships
  for select using (user_id = auth.uid() or has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin());
create policy "memberships_admin_write" on public.memberships
  for all using (has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin())
  with check (has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin());

-- ── PLATFORM ADMINS ──────────────────────────────────────────
create policy "platform_admins_self_read" on public.platform_admins
  for select using (user_id = auth.uid());

-- ── MENU ITEMS / VARIANTS ────────────────────────────────────
create policy "menu_items_public_read" on public.menu_items for select using (true);
create policy "menu_items_admin_write" on public.menu_items
  for all using (has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin())
  with check (has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin());

create policy "menu_variants_public_read" on public.menu_variants for select using (true);
create policy "menu_variants_admin_write" on public.menu_variants
  for all using (has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin())
  with check (has_role(tenant_id, array['admin']::public.rol_staff[]) or is_platform_admin());

-- ── PEDIDOS ──────────────────────────────────────────────────
create policy "pedidos_public_insert" on public.pedidos
  for insert with check (exists (select 1 from public.tenants t where t.id = tenant_id and t.activo = true));
create policy "pedidos_member_read" on public.pedidos
  for select using (is_member(tenant_id) or is_platform_admin());
create policy "pedidos_member_update" on public.pedidos
  for update using (is_member(tenant_id)) with check (is_member(tenant_id));
create policy "pedidos_member_delete" on public.pedidos
  for delete using (is_member(tenant_id));
