-- ============================================================
--  0022 — Hora en que el pedido pasa a "listo".
--  La usa el seguimiento del cliente: 5 minutos después de "Listo,
--  saliendo" muestra "En camino a tu casa". La pone un trigger de la
--  base, así la caja no cambia y nada se rompe si esta migración
--  todavía no se aplicó. Si se reabre y vuelve a listo, se actualiza.
--  IDEMPOTENTE.
-- ============================================================

alter table public.pedidos add column if not exists hora_listo timestamptz;

create or replace function public.pedidos_marcar_hora_listo()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.estado = 'listo' and old.estado is distinct from 'listo' then
    new.hora_listo := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_hora_listo on public.pedidos;
create trigger trg_pedidos_hora_listo
  before update of estado on public.pedidos
  for each row
  execute function public.pedidos_marcar_hora_listo();
