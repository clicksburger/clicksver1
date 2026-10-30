-- ============================================================
--  STORAGE — bucket tenant-assets (IDEMPOTENTE)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tenant-assets', 'tenant-assets', true)
on conflict (id) do nothing;

-- Limpiar políticas legacy y re-runs.
drop policy if exists "public read tenant-assets"    on storage.objects;
drop policy if exists "service write tenant-assets"  on storage.objects;
drop policy if exists "service update tenant-assets" on storage.objects;
drop policy if exists "service delete tenant-assets" on storage.objects;
drop policy if exists "tenant_assets_public_read"    on storage.objects;
drop policy if exists "tenant_assets_auth_write"     on storage.objects;
drop policy if exists "tenant_assets_auth_update"    on storage.objects;
drop policy if exists "tenant_assets_auth_delete"    on storage.objects;

create policy "tenant_assets_public_read" on storage.objects
  for select using (bucket_id = 'tenant-assets');
create policy "tenant_assets_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'tenant-assets');
create policy "tenant_assets_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'tenant-assets');
create policy "tenant_assets_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'tenant-assets');
