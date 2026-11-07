-- ============================================================
--  0025 — Rechazar un pedido ya no lo borra.
--  Antes "Rechazar" en Caja hacía DELETE: si era una equivocación,
--  el pedido se perdía. Ahora pasa a estado 'rechazado' y se puede
--  restaurar desde la pestaña "Rechazados" de Caja.
--    · hora_rechazado: la pone un trigger al pasar a 'rechazado' y la
--      limpia al restaurar (igual que hora_listo en 0022).
--    · motivo_rechazo: opcional, lo carga la caja al rechazar.
--    · Borrar pedidos queda solo para admin / superadmin: el cajero
--      ya no puede hacer DELETE ni por la API.
--  La retención de 30 días (0018) sigue igual y también limpia
--  los rechazados.
--  IDEMPOTENTE.
-- ============================================================

alter table public.pedidos add column if not exists hora_rechazado timestamptz;
alter table public.pedidos add column if not exists motivo_rechazo text;

create or replace function public.pedidos_marcar_hora_rechazado()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.estado = 'rechazado' and old.estado is distinct from 'rechazado' then
    new.hora_rechazado := now();
  elsif new.estado is distinct from 'rechazado' and old.estado = 'rechazado' then
    -- Restaurado: vuelve a la cola como si nunca se hubiera rechazado.
    new.hora_rechazado := null;
    new.motivo_rechazo := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedidos_hora_rechazado on public.pedidos;
create trigger trg_pedidos_hora_rechazado
  before update of estado on public.pedidos
  for each row
  execute function public.pedidos_marcar_hora_rechazado();

-- Solo admin (o superadmin) puede borrar pedidos.
drop policy if exists "pedidos_member_delete" on public.pedidos;
create policy "pedidos_member_delete" on public.pedidos for delete
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());

-- Pestaña "Rechazados" de Caja: rechazados recientes por tenant.
create index if not exists idx_pedidos_tenant_rechazado
  on public.pedidos(tenant_id, hora_rechazado desc)
  where estado = 'rechazado';
