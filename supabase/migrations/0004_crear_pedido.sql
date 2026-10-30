-- ============================================================
--  0004 — Versiona crear_pedido (estaba en la DB sin migración)
--  y elimina next_pedido_num (sin uso + fuga de info vía RPC).
--  IDEMPOTENTE.
-- ============================================================

create or replace function public.crear_pedido(
  p_tenant_id uuid, p_tipo text, p_nombre text, p_items jsonb
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_num    integer;
  v_activo boolean;
begin
  select activo into v_activo from public.tenants where id = p_tenant_id;
  if v_activo is null then
    raise exception 'Tenant inexistente' using errcode = 'P0002';
  end if;
  if not v_activo then
    raise exception 'Tenant inactivo' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 0));

  select coalesce(max(num), 0) + 1 into v_num
  from public.pedidos
  where tenant_id = p_tenant_id;

  insert into public.pedidos (tenant_id, num, estado, tipo, nombre, items)
  values (
    p_tenant_id, v_num, 'nuevo',
    coalesce(p_tipo, 'delivery'), p_nombre, coalesce(p_items, '[]'::jsonb)
  );

  return v_num;
end;
$$;

-- Creación de pedido es pública por diseño (cliente anónimo desde el menú).
revoke all on function public.crear_pedido(uuid, text, text, jsonb) from public;
grant execute on function public.crear_pedido(uuid, text, text, jsonb) to anon, authenticated, service_role;

-- next_pedido_num quedó reemplazada por crear_pedido (atómica). Se elimina.
drop function if exists public.next_pedido_num(uuid);
