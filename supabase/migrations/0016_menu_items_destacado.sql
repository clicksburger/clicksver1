-- ============================================================
--  0016 — Producto "destacado" por tenant.
--  Permite que cada tenant marque uno o más productos como
--  destacados para resaltarlos en el menú público (banner hero).
--  Columna booleana con default false. IDEMPOTENTE.
-- ============================================================

alter table public.menu_items
  add column if not exists destacado boolean not null default false;

-- Índice parcial: acelera la búsqueda del/los destacado(s) de un tenant
-- sin penalizar al resto de las filas (la mayoría serán false).
create index if not exists idx_menu_items_destacado
  on public.menu_items(tenant_id)
  where destacado;
