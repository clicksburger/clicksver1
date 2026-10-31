-- ============================================================
--  0020 — Promociones con vencimiento.
--  · menu_items.vigente_hasta: último día comercial (hora de Buenos
--    Aires) en que el producto se ofrece. null = sin vencimiento.
--    La carta y el checkout dejan de ofrecerlo al día siguiente; la
--    fila se conserva para los reportes.
--  · Categoría "Promociones" para Clicks, primera en la carta.
--  · Promo Halloween: CRYSPY DOBLE + BONIATOS, $13.500, destacada,
--    válida hasta el 01/11/2026 inclusive.
--  IDEMPOTENTE: se puede volver a correr sin duplicar filas.
-- ============================================================

alter table public.menu_items add column if not exists vigente_hasta date;

do $$
declare
  business_id uuid;
  category_id uuid;
  product_id uuid;
begin
  select id into strict business_id from public.tenants where slug = 'clicks-burger';

  select id into category_id from public.categorias
    where tenant_id = business_id and lower(nombre) = 'promociones';
  if category_id is null then
    insert into public.categorias (tenant_id, nombre, orden)
      values (business_id, 'Promociones', -1)
      returning id into category_id;
  end if;

  select id into product_id from public.menu_items
    where tenant_id = business_id and lower(nombre) = lower('CRYSPY DOBLE + BONIATOS');
  if product_id is null then
    insert into public.menu_items (tenant_id, nombre, categoria, categoria_id)
      values (business_id, 'CRYSPY DOBLE + BONIATOS', 'Promociones', category_id)
      returning id into product_id;
  end if;

  update public.menu_items set
    descripcion   = 'Promo Halloween: Crispy Clicks doble en pan negro + porción de boniatos de 150 g. Válida hasta el 1 de noviembre inclusive.',
    categoria     = 'Promociones',
    categoria_id  = category_id,
    precio        = 13500,
    imagen_url    = '/img/promo-cryspy-doble.jpg',
    activo        = true,
    destacado     = true,
    vigente_hasta = date '2026-11-01',
    orden         = 0
  where id = product_id and tenant_id = business_id;

  -- Precio único: la promo no tiene variantes.
  delete from public.menu_variants where tenant_id = business_id and menu_item_id = product_id;
end $$;
