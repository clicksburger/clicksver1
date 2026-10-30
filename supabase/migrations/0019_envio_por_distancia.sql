-- ============================================================
--  0019 — Costo de envío por distancia.
--  · tenants.envio_config: dirección/coordenadas del local y tramos
--    de precio por km. Lectura pública (la usa el checkout) y edición
--    solo del admin, con las políticas de tenants que ya existen.
--  · pedidos.costo_envio: costo del envío del pedido. null = no aplica
--    (retiro/salón) o "a confirmar" (fuera de rango o dirección no
--    encontrada). Caja puede cargarlo después al editar el pedido.
--  · caja_ventas: el cierre de caja suma productos + envíos y además
--    informa el total de envíos por separado.
--  IDEMPOTENTE.
-- ============================================================

alter table public.tenants add column if not exists envio_config jsonb;

alter table public.pedidos add column if not exists costo_envio numeric(12,2);
alter table public.pedidos drop constraint if exists pedidos_costo_envio_no_negativo;
alter table public.pedidos add constraint pedidos_costo_envio_no_negativo
  check (costo_envio is null or costo_envio >= 0);

-- Configuración inicial de Clicks (editable desde Configuración → Envíos).
-- lat/lng quedan null: se completan solos la primera vez que se calcula un envío
-- o al guardar la configuración (geocodificación de la dirección del local).
update public.tenants
set envio_config = jsonb_build_object(
  'direccion', 'Fray Luis Beltrán 2735, Córdoba, Argentina',
  'lat', null,
  'lng', null,
  'tramos', jsonb_build_array(
    jsonb_build_object('hastaKm', 1,   'costo', 1000),
    jsonb_build_object('hastaKm', 2.5, 'costo', 1500),
    jsonb_build_object('hastaKm', 3.5, 'costo', 2000),
    jsonb_build_object('hastaKm', 4.5, 'costo', 3000)
  )
)
where slug = 'clicks-burger' and envio_config is null;

-- caja_ventas cambia su tipo de retorno (agrega "envios"): hay que recrearla.
drop function if exists public.caja_ventas(uuid, timestamptz, timestamptz);
create function public.caja_ventas(
  p_tenant_id uuid, p_desde timestamptz, p_hasta timestamptz default now()
) returns table(total numeric, cantidad bigint, envios numeric)
language sql stable security invoker set search_path = public as $$
  with entregados as (
    select p.id, p.items, coalesce(p.costo_envio, 0) as envio
    from public.pedidos p
    where p.tenant_id = p_tenant_id
      and p.estado = 'entregado'
      and coalesce(p.hora_entregado, p.creado_en) >= p_desde
      and coalesce(p.hora_entregado, p.creado_en) <  p_hasta
  ),
  productos as (
    select coalesce(sum((it->>'precio')::numeric * (it->>'cantidad')::numeric), 0) as total
    from entregados e
    cross join lateral jsonb_array_elements(e.items) it
  )
  select
    ((select total from productos) + coalesce(sum(e.envio), 0))::numeric as total,
    count(*)::bigint as cantidad,
    coalesce(sum(e.envio), 0)::numeric as envios
  from entregados e;
$$;

revoke all on function public.caja_ventas(uuid, timestamptz, timestamptz) from public;
grant execute on function public.caja_ventas(uuid, timestamptz, timestamptz) to authenticated, service_role;
