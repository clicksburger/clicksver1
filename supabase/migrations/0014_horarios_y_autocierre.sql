-- 0014 — Horarios de atención por tenant + validación + auto-cierre.
-- horarios jsonb keyed por día (0=Dom..6=Sab): {"0":{"abierto":true,"abre":"11:00","cierra":"23:30"}}
-- null/'{}' => siempre abierto. Zona: America/Argentina/Buenos_Aires. IDEMPOTENTE.
alter table public.tenants add column if not exists horarios jsonb;

create or replace function private.esta_abierto(p_horarios jsonb, p_ahora timestamptz)
returns boolean language plpgsql stable set search_path = public as $$
declare
  v_ar timestamp := p_ahora at time zone 'America/Argentina/Buenos_Aires';
  v_dow int := extract(dow from v_ar)::int;
  v_min int := (extract(hour from v_ar)*60 + extract(minute from v_ar))::int;
  v_today jsonb := p_horarios -> v_dow::text;
  v_yest  jsonb := p_horarios -> (((v_dow + 6) % 7))::text;
  a int; c int;
begin
  if p_horarios is null or p_horarios = '{}'::jsonb then return true; end if;
  if v_today is not null and coalesce((v_today->>'abierto')::boolean,false)
     and (v_today->>'abre') ~ '^\d{1,2}:\d{2}$' and (v_today->>'cierra') ~ '^\d{1,2}:\d{2}$' then
    a := split_part(v_today->>'abre',':',1)::int*60 + split_part(v_today->>'abre',':',2)::int;
    c := split_part(v_today->>'cierra',':',1)::int*60 + split_part(v_today->>'cierra',':',2)::int;
    if a <= c then if v_min >= a and v_min < c then return true; end if;
    else if v_min >= a then return true; end if; end if;
  end if;
  if v_yest is not null and coalesce((v_yest->>'abierto')::boolean,false)
     and (v_yest->>'abre') ~ '^\d{1,2}:\d{2}$' and (v_yest->>'cierra') ~ '^\d{1,2}:\d{2}$' then
    a := split_part(v_yest->>'abre',':',1)::int*60 + split_part(v_yest->>'abre',':',2)::int;
    c := split_part(v_yest->>'cierra',':',1)::int*60 + split_part(v_yest->>'cierra',':',2)::int;
    if a > c and v_min < c then return true; end if;
  end if;
  return false;
end; $$;

create or replace function public.crear_pedido(p_tenant_id uuid, p_tipo text, p_nombre text, p_items jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_num integer; v_activo boolean; v_horarios jsonb;
begin
  select activo, horarios into v_activo, v_horarios from public.tenants where id = p_tenant_id;
  if v_activo is null then raise exception 'Tenant inexistente' using errcode='P0002'; end if;
  if not v_activo then raise exception 'Tenant inactivo' using errcode='P0001'; end if;
  if not private.esta_abierto(v_horarios, now()) then
    raise exception 'El local está cerrado en este horario' using errcode='P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));
  select coalesce(max(num),0)+1 into v_num from public.pedidos where tenant_id = p_tenant_id;
  insert into public.pedidos (tenant_id, num, estado, tipo, nombre, items)
  values (p_tenant_id, v_num, 'nuevo', coalesce(p_tipo,'delivery'), p_nombre, coalesce(p_items,'[]'::jsonb));
  return v_num;
end; $$;

create or replace function public.auto_cerrar_cajas()
returns integer language plpgsql security definer set search_path = public as $$
declare v_t record; v_total numeric; v_cant bigint; v_count int := 0;
begin
  for v_t in select * from public.caja_turnos where cerrado_en is null loop
    select total, cantidad into v_total, v_cant from public.caja_ventas(v_t.tenant_id, v_t.abierto_en, now());
    update public.caja_turnos
    set cerrado_en=now(), cerrado_por=null, monto_final=null,
        ventas=coalesce(v_total,0), pedidos_count=coalesce(v_cant,0),
        diferencia=null, nota_cierre='Cierre automático'
    where id = v_t.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;
revoke all on function public.auto_cerrar_cajas() from public, anon, authenticated;
