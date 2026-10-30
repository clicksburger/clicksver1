-- ============================================================
--  0011 — Cocina pasa a SOLO LECTURA.
--  La escritura de pedidos (update/delete) queda restringida a
--  admin y cajero. El rol 'cocina' puede leer (member_read) pero
--  ya no puede modificar estados ni borrar — ni vía API directa.
--  Además se migra el estado deprecado 'confirmado' -> 'en_cocina'
--  (el botón Confirmar de Caja ahora inicia la preparación directo).
--  IDEMPOTENTE.
-- ============================================================

drop policy if exists "pedidos_member_update" on public.pedidos;
create policy "pedidos_member_update" on public.pedidos for update
  using (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin())
  with check (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin());

drop policy if exists "pedidos_member_delete" on public.pedidos;
create policy "pedidos_member_delete" on public.pedidos for delete
  using (private.has_role(tenant_id, array['admin','cajero']::public.rol_staff[]) or private.is_platform_admin());

-- Estado 'confirmado' deprecado: se colapsa en 'en_cocina'.
update public.pedidos set estado = 'en_cocina' where estado = 'confirmado';
