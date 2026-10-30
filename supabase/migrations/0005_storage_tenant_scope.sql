-- ============================================================
--  0005 — Aislamiento multi-tenant del bucket tenant-assets.
--  Antes: cualquier usuario autenticado podía escribir/borrar
--  CUALQUIER objeto. Ahora: solo admin del tenant dueño del path
--  (path = "<tenant_id>/<folder>/<file>") o platform admin.
--  La lectura pública se mantiene (logos servidos por URL pública).
--  IDEMPOTENTE.
-- ============================================================

drop policy if exists "tenant_assets_auth_write"    on storage.objects;
drop policy if exists "tenant_assets_auth_update"   on storage.objects;
drop policy if exists "tenant_assets_auth_delete"   on storage.objects;
drop policy if exists "tenant_assets_tenant_write"  on storage.objects;
drop policy if exists "tenant_assets_tenant_update" on storage.objects;
drop policy if exists "tenant_assets_tenant_delete" on storage.objects;

create policy "tenant_assets_tenant_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tenant-assets'
    and (
      exists (select 1 from public.memberships m
              where m.user_id = (select auth.uid()) and m.rol = 'admin'
                and m.tenant_id::text = (storage.foldername(name))[1])
      or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
    )
  );

create policy "tenant_assets_tenant_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tenant-assets'
    and (
      exists (select 1 from public.memberships m
              where m.user_id = (select auth.uid()) and m.rol = 'admin'
                and m.tenant_id::text = (storage.foldername(name))[1])
      or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'tenant-assets'
    and (
      exists (select 1 from public.memberships m
              where m.user_id = (select auth.uid()) and m.rol = 'admin'
                and m.tenant_id::text = (storage.foldername(name))[1])
      or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
    )
  );

create policy "tenant_assets_tenant_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tenant-assets'
    and (
      exists (select 1 from public.memberships m
              where m.user_id = (select auth.uid()) and m.rol = 'admin'
                and m.tenant_id::text = (storage.foldername(name))[1])
      or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
    )
  );
