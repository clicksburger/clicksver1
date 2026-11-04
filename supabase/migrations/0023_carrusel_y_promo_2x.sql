-- ============================================================
--  0023 — Carrusel gestionable y promo 2x de martes a jueves.
--  · tenants.carrusel_config: modo (auto / promo / normal), días de
--    la promo y productos de cada carrusel. Lectura pública (la usa
--    la carta); la escriben las acciones del panel tras validar rol.
--  · Producto "PROMO 2 BURGERS" en Hamburguesas: 2 simples $21.000,
--    2 dobles $25.000, 2 triples $31.000. Solo se vende con la promo
--    del día activa.
--  · Configuración inicial: automático martes a jueves; carrusel de
--    promo con la 2x y carrusel normal con la Cryspy de Halloween
--    (vencida: se muestra "No disponible"). No pisa una config existente.
--  IDEMPOTENTE.
-- ============================================================

alter table public.tenants add column if not exists carrusel_config jsonb;

do $$
declare
  business_id uuid;
  burgers_id uuid;
  promo_id uuid;
  halloween_id uuid;
  opcion record;
  variante_id uuid;
begin
  select id into strict business_id from public.tenants where slug = 'clicks-burger';
  select id into strict burgers_id from public.categorias
    where tenant_id = business_id and lower(nombre) = 'hamburguesas';

  select id into promo_id from public.menu_items
    where tenant_id = business_id and lower(nombre) = lower('PROMO 2 BURGERS');
  if promo_id is null then
    insert into public.menu_items (tenant_id, nombre, categoria, categoria_id)
      values (business_id, 'PROMO 2 BURGERS', 'Hamburguesas', burgers_id)
      returning id into promo_id;
  end if;
  update public.menu_items set
    descripcion  = 'Martes, miércoles y jueves: 2 burgers de la carta. Elegí el tamaño y contanos cuáles querés en Observaciones.',
    categoria    = 'Hamburguesas',
    categoria_id = burgers_id,
    precio       = null,
    activo       = true,
    orden        = -2
  where id = promo_id and tenant_id = business_id;

  for opcion in
    select * from (values ('2 Simples', 21000, 0), ('2 Dobles', 25000, 1), ('2 Triples', 31000, 2))
      as v(label, precio, orden)
  loop
    select id into variante_id from public.menu_variants
      where tenant_id = business_id and menu_item_id = promo_id and lower(label) = lower(opcion.label);
    if variante_id is null then
      insert into public.menu_variants (tenant_id, menu_item_id, label, precio, orden)
        values (business_id, promo_id, opcion.label, opcion.precio, opcion.orden);
    else
      update public.menu_variants set precio = opcion.precio, orden = opcion.orden
        where id = variante_id;
    end if;
  end loop;

  select id into halloween_id from public.menu_items
    where tenant_id = business_id and lower(nombre) = lower('CRYSPY DOBLE + BONIATOS');

  update public.tenants set carrusel_config = jsonb_build_object(
      'modo', 'auto',
      'diasPromo', jsonb_build_array(2, 3, 4),
      'promo', jsonb_build_array(promo_id),
      'normal', case when halloween_id is null then '[]'::jsonb else jsonb_build_array(halloween_id) end
    )
  where id = business_id and carrusel_config is null;
end $$;
