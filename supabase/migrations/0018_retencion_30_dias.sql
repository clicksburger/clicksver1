-- ============================================================
--  0018 — Retención de 30 días.
--  Todos los días a las 06:30 de Argentina (09:30 UTC, después del
--  auto-cierre de las 06:00) se borran:
--    · pedidos creados hace más de 30 días;
--    · turnos de caja cerrados hace más de 30 días.
--  Nunca toca la caja abierta. El detalle de cada turno queda en el
--  Excel que se descarga al cerrar la caja.
--  IDEMPOTENTE: se puede volver a correr sin duplicar el job.
-- ============================================================

create or replace function public.limpiar_historial(p_dias integer default 30)
returns table(pedidos_borrados bigint, turnos_borrados bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_limite timestamptz := now() - make_interval(days => greatest(p_dias, 30));
  v_pedidos bigint;
  v_turnos bigint;
begin
  with borrados as (
    delete from public.pedidos where creado_en < v_limite returning 1
  ) select count(*) into v_pedidos from borrados;

  with borrados as (
    delete from public.caja_turnos
    where cerrado_en is not null and cerrado_en < v_limite
    returning 1
  ) select count(*) into v_turnos from borrados;

  return query select v_pedidos, v_turnos;
end; $$;

-- Solo la ejecuta el cron (o alguien con acceso al SQL Editor).
revoke all on function public.limpiar_historial(integer) from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'limpiar-historial-30-dias';
select cron.schedule(
  'limpiar-historial-30-dias',
  '30 9 * * *',
  $$ select public.limpiar_historial(30); $$
);
