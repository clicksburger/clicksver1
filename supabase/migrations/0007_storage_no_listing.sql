-- ============================================================
--  0007 — Bucket tenant-assets: eliminar el listado anónimo.
--  El SELECT amplio permitía a cualquiera ENUMERAR todos los
--  archivos del bucket. Lo reemplazamos por uno acotado al tenant
--  (solo miembros del propio tenant o platform admin pueden listar).
--  La lectura pública por URL NO usa esta policy (bucket public),
--  así que los logos siguen cargando para clientes anónimos.
--  IDEMPOTENTE.
-- ============================================================

drop policy if exists "tenant_assets_public_read" on storage.objects;
drop policy if exists "tenant_assets_tenant_read" on storage.objects;

create policy "tenant_assets_tenant_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tenant-assets'
    and (
      exists (select 1 from public.memberships m
              where m.user_id = (select auth.uid())
                and m.tenant_id::text = (storage.foldername(name))[1])
      or exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()))
    )
  );
