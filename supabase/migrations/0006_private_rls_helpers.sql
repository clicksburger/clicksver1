-- ============================================================
--  0006 — Mueve los helpers de RLS a un schema privado.
--  Antes eran SECURITY DEFINER en public => invocables como RPC
--  (/rest/v1/rpc/...). En 'private' (no expuesto por PostgREST)
--  dejan de ser invocables, pero la RLS los sigue usando.
--  Bonus: (select auth.uid()) evita re-evaluacion por fila (initplan).
--  IDEMPOTENTE.
-- ============================================================

create schema if not exists private;

create or replace function private.is_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where user_id = (select auth.uid()) and tenant_id = p_tenant_id);
$$;

create or replace function private.has_role(p_tenant_id uuid, p_roles public.rol_staff[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where user_id = (select auth.uid()) and tenant_id = p_tenant_id and rol = any(p_roles));
$$;

create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- tenants
drop policy if exists "tenants_public_read" on public.tenants;
create policy "tenants_public_read" on public.tenants for select
  using (activo = true or private.is_member(id) or private.is_platform_admin());
drop policy if exists "tenants_admin_update" on public.tenants;
create policy "tenants_admin_update" on public.tenants for update
  using (private.has_role(id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
drop policy if exists "tenants_platform_insert" on public.tenants;
create policy "tenants_platform_insert" on public.tenants for insert
  with check (private.is_platform_admin());
drop policy if exists "tenants_platform_delete" on public.tenants;
create policy "tenants_platform_delete" on public.tenants for delete
  using (private.is_platform_admin());

-- memberships
drop policy if exists "memberships_self_read" on public.memberships;
create policy "memberships_self_read" on public.memberships for select
  using (user_id = (select auth.uid())
         or private.has_role(tenant_id, array['admin']::public.rol_staff[])
         or private.is_platform_admin());
drop policy if exists "memberships_admin_write" on public.memberships;
create policy "memberships_admin_write" on public.memberships for all
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());

-- platform_admins
drop policy if exists "platform_admins_self_read" on public.platform_admins;
create policy "platform_admins_self_read" on public.platform_admins for select
  using (user_id = (select auth.uid()));

-- menu
drop policy if exists "menu_items_admin_write" on public.menu_items;
create policy "menu_items_admin_write" on public.menu_items for all
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
drop policy if exists "menu_variants_admin_write" on public.menu_variants;
create policy "menu_variants_admin_write" on public.menu_variants for all
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());

-- pedidos
drop policy if exists "pedidos_member_read" on public.pedidos;
create policy "pedidos_member_read" on public.pedidos for select
  using (private.is_member(tenant_id) or private.is_platform_admin());
drop policy if exists "pedidos_member_update" on public.pedidos;
create policy "pedidos_member_update" on public.pedidos for update
  using (private.is_member(tenant_id)) with check (private.is_member(tenant_id));
drop policy if exists "pedidos_member_delete" on public.pedidos;
create policy "pedidos_member_delete" on public.pedidos for delete
  using (private.is_member(tenant_id));

-- Eliminar helpers publicos (ya sin dependencias)
drop function if exists public.is_member(uuid);
drop function if exists public.has_role(uuid, public.rol_staff[]);
drop function if exists public.is_platform_admin();

-- Permisos: ejecutables para que la RLS funcione, NO expuestos como RPC
grant usage on schema private to anon, authenticated, service_role;
revoke all on function private.is_member(uuid)                    from public;
revoke all on function private.has_role(uuid, public.rol_staff[]) from public;
revoke all on function private.is_platform_admin()               from public;
grant execute on function private.is_member(uuid)                    to anon, authenticated, service_role;
grant execute on function private.has_role(uuid, public.rol_staff[]) to anon, authenticated, service_role;
grant execute on function private.is_platform_admin()               to anon, authenticated, service_role;
