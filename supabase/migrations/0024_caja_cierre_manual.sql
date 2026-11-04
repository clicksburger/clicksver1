-- ============================================================
--  0024 — Apertura y cierre de caja solo manuales.
--  Desactiva el cierre automático de las 06:00 (tarea de pg_cron
--  "auto-cerrar-cajas" creada en 0015). La caja se abre y se cierra
--  únicamente desde "Cierre de caja". La función auto_cerrar_cajas()
--  queda en la base sin uso, por si se quiere volver a programar.
--  IDEMPOTENTE: si la tarea no existe, no hace nada.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'auto-cerrar-cajas';
  end if;
end $$;
