-- ============================================================
--  0012 — Apertura/cierre de caja (turnos).
--  Una caja abierta por local a la vez (índice parcial único).
--  Ventas del turno = pedidos entregados en el rango, calculadas al cerrar.
--  Escritura para admin/cajero; lectura admin/cajero; borrado admin.
--  IDEMPOTENTE.
-- ============================================================

create table if not exists public.caja_turnos (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         uuid        not null references public.tenants(id) on delete cascade,
  abierto_por       uuid        not null references auth.users(id),
  abierto_por_email text,
  abierto_en        timestamptz not null default now(),
  monto_inicial     numeric(12,2) not null default 0,
  cerrado_por       uuid        references auth.users(id),
  cerrado_en        timestamptz,
  monto_final       numeric(12,2),
  ventas            numeric(12,2),
  pedidos_count     integer,
  diferencia        numeric(12,2),
  nota_apertura     text,
  nota_cierre       text
);

create index if not exists idx_caja_turnos_tenant on public.caja_turnos(tenant_id, abierto_en desc);
create unique index if not exists uniq_caja_abierta on public.caja_turnos(tenant_id) where cerrado_en is null;

alter table public.caja_turnos enable row level security;

drop policy if exists "caja_turnos_staff_read"   on public.caja_turnos;
drop policy if exists "caja_turnos_staff_insert" on public.caja_turnos;
drop policy if exists "caja_turnos_staff_update" on public.caja_turnos;
drop policy if exists "caja_turnos_admin_delete" on public.caja_turnos;

create policy "caja_turnos_staff_read" on public.caja_turnos for select
  using (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin());

create policy "caja_turnos_staff_insert" on public.caja_turnos for insert
  with check (
    (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin())
    and abierto_por = (select auth.uid())
  );

create policy "caja_turnos_staff_update" on public.caja_turnos for update
  using (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin());

create policy "caja_turnos_admin_delete" on public.caja_turnos for delete
  using (private.has_role(tenant_id, array['admin']::public.rol_staff[]) or private.is_platform_admin());

create or replace function public.caja_ventas(
  p_tenant_id uuid, p_desde timestamptz, p_hasta timestamptz default now()
) returns table(total numeric, cantidad bigint)
language sql stable security invoker set search_path = public as $$
  select
    coalesce(sum((it->>'precio')::numeric * (it->>'cantidad')::numeric), 0)::numeric as total,
    count(distinct p.id) as cantidad
  from public.pedidos p
  left join lateral jsonb_array_elements(p.items) it on true
  where p.tenant_id = p_tenant_id
    and p.estado = 'entregado'
    and coalesce(p.hora_entregado, p.creado_en) >= p_desde
    and coalesce(p.hora_entregado, p.creado_en) <  p_hasta;
$$;

create or replace function public.cerrar_caja(
  p_turno_id uuid, p_monto_final numeric, p_nota text default null
) returns public.caja_turnos
language plpgsql security invoker set search_path = public as $$
declare
  v_turno public.caja_turnos;
  v_total numeric;
  v_cant  bigint;
begin
  select * into v_turno from public.caja_turnos where id = p_turno_id;
  if v_turno.id is null then raise exception 'Turno inexistente' using errcode = 'P0002'; end if;
  if v_turno.cerrado_en is not null then raise exception 'La caja ya está cerrada' using errcode = 'P0001'; end if;

  select total, cantidad into v_total, v_cant
  from public.caja_ventas(v_turno.tenant_id, v_turno.abierto_en, now());

  update public.caja_turnos
  set cerrado_por   = (select auth.uid()),
      cerrado_en    = now(),
      monto_final   = p_monto_final,
      ventas        = coalesce(v_total, 0),
      pedidos_count = coalesce(v_cant, 0),
      diferencia    = p_monto_final - (monto_inicial + coalesce(v_total, 0)),
      nota_cierre   = p_nota
  where id = p_turno_id
  returning * into v_turno;

  return v_turno;
end; $$;

revoke all on function public.caja_ventas(uuid, timestamptz, timestamptz) from public;
revoke all on function public.cerrar_caja(uuid, numeric, text)         from public;
grant execute on function public.caja_ventas(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.cerrar_caja(uuid, numeric, text)         to authenticated, service_role;
