-- ============================================================
--  0021 — La promo CRYSPY DOBLE + BONIATOS va dentro de
--  Hamburguesas (primera de la lista), para verla junto al resto
--  de las burgers. La carta la resalta por ser destacada y tener
--  vencimiento. La categoría "Promociones" se borra solo si quedó
--  vacía. IDEMPOTENTE.
-- ============================================================

do $$
declare
  business_id uuid;
  burgers_id uuid;
begin
  select id into strict business_id from public.tenants where slug = 'clicks-burger';
  select id into strict burgers_id from public.categorias
    where tenant_id = business_id and lower(nombre) = 'hamburguesas';

  update public.menu_items set
    categoria    = 'Hamburguesas',
    categoria_id = burgers_id,
    orden        = -1
  where tenant_id = business_id and lower(nombre) = lower('CRYSPY DOBLE + BONIATOS');

  delete from public.categorias c
  where c.tenant_id = business_id
    and lower(c.nombre) = 'promociones'
    and not exists (select 1 from public.menu_items m where m.categoria_id = c.id);
end $$;
