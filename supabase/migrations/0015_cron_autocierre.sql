-- 0015 — Auto-cierre de cajas a las 06:00 AR (09:00 UTC) vía pg_cron.
create extension if not exists pg_cron;
select cron.schedule('auto-cerrar-cajas', '0 9 * * *', $$ select public.auto_cerrar_cajas(); $$);
