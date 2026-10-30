-- ============================================================
--  0010 — Separar las policies "_admin_write" (FOR ALL) en
--  insert/update/delete. FOR ALL incluía SELECT y se solapaba
--  con las policies de lectura (multiple_permissive_policies),
--  obligando a evaluar 2 policies por cada lectura.
--  La lectura sigue cubierta por *_public_read / *_self_read.
--  IDEMPOTENTE.
-- ============================================================

-- memberships
drop policy if exists "memberships_admin_write"  on public.memberships;
drop policy if exists "memberships_admin_insert" on public.memberships;
drop policy if exists "memberships_admin_update" on public.memberships;
drop policy if exists "memberships_admin_delete" on public.memberships;
create policy "memberships_admin_insert" on public.memberships for insert
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "memberships_admin_update" on public.memberships for update
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "memberships_admin_delete" on public.memberships for delete
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());

-- menu_items
drop policy if exists "menu_items_admin_write"  on public.menu_items;
drop policy if exists "menu_items_admin_insert" on public.menu_items;
drop policy if exists "menu_items_admin_update" on public.menu_items;
drop policy if exists "menu_items_admin_delete" on public.menu_items;
create policy "menu_items_admin_insert" on public.menu_items for insert
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "menu_items_admin_update" on public.menu_items for update
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "menu_items_admin_delete" on public.menu_items for delete
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());

-- menu_variants
drop policy if exists "menu_variants_admin_write"  on public.menu_variants;
drop policy if exists "menu_variants_admin_insert" on public.menu_variants;
drop policy if exists "menu_variants_admin_update" on public.menu_variants;
drop policy if exists "menu_variants_admin_delete" on public.menu_variants;
create policy "menu_variants_admin_insert" on public.menu_variants for insert
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "menu_variants_admin_update" on public.menu_variants for update
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
create policy "menu_variants_admin_delete" on public.menu_variants for delete
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());
