-- ============================================================
--  0009 — Índice parcial para la carga de las boards.
--  Nuevo patrón de acceso: pedidos activos (estado <> entregado)
--  ordenados por num. El índice parcial mantiene chico el set
--  caliente aunque crezca el historial de entregados.
--  IDEMPOTENTE.
-- ============================================================
create index if not exists idx_pedidos_activos
  on public.pedidos(tenant_id, num)
  where estado <> 'entregado';
