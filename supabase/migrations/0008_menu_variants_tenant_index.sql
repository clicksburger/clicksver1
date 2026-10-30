-- ============================================================
--  0008 — Índice de cobertura para menu_variants.tenant_id.
--  getMenu filtra `eq('tenant_id', ...)`; la FK no tenía índice.
--  IDEMPOTENTE.
-- ============================================================
create index if not exists idx_menu_variants_tenant on public.menu_variants(tenant_id, orden);
