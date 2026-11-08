-- ============================================================
--  0026 — Fotos nuevas de American, Crispy y Supreme Bacon.
--  · Foto principal de cada una (las demás tomas rotan en la carta
--    y en el carrusel: ver FOTOS en src/features/menu/promos.ts).
--  · Las suma al principio del carrusel normal, si no estaban.
--    No toca el carrusel de promo: lo que está ahí solo se vende
--    los días de promo.
--  Requiere 0023 (tenants.carrusel_config).
--  IDEMPOTENTE.
-- ============================================================

do $$
declare
  business_id uuid;
  nuevos jsonb;
begin
  select id into strict business_id from public.tenants where slug = 'clicks-burger';

  update public.menu_items m set imagen_url = v.foto
  from (values
    ('AMERICAN CLICKS', '/img/american-clicks-1.jpg'),
    ('CRISPY CLICKS', '/img/crispy-clicks-1.jpg'),
    ('SUPREME BACON CLICKS', '/img/supreme-bacon-1.jpg')
  ) as v(nombre, foto)
  where m.tenant_id = business_id and upper(trim(m.nombre)) = v.nombre;

  select coalesce(jsonb_agg(to_jsonb(m.id::text) order by v.orden), '[]'::jsonb)
    into nuevos
  from (values ('AMERICAN CLICKS', 1), ('CRISPY CLICKS', 2), ('SUPREME BACON CLICKS', 3))
    as v(nombre, orden)
  join public.menu_items m
    on m.tenant_id = business_id and upper(trim(m.nombre)) = v.nombre and m.activo
  join public.tenants t on t.id = business_id
  where not coalesce(t.carrusel_config -> 'normal', '[]'::jsonb) ? m.id::text;

  update public.tenants set carrusel_config = jsonb_set(
      coalesce(
        carrusel_config,
        jsonb_build_object('modo', 'auto', 'diasPromo', jsonb_build_array(2, 3, 4), 'promo', '[]'::jsonb)
      ),
      '{normal}',
      nuevos || coalesce(carrusel_config -> 'normal', '[]'::jsonb)
    )
  where id = business_id and jsonb_array_length(nuevos) > 0;
end $$;
