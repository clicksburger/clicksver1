-- ============================================================
--  SEED — tenant demo "Clicks Burger" + catálogo inicial
--  Los usuarios de staff se crean vía Supabase Auth y luego se
--  vinculan en memberships (ver README).
-- ============================================================
insert into public.tenants (slug, nombre, color_primario, color_fondo)
values ('clicks-burger', 'Clicks Burger', '#F5A300', '#0f0f0f')
on conflict (slug) do nothing;

with t as (select id from public.tenants where slug = 'clicks-burger')
insert into public.menu_items (tenant_id, nombre, descripcion, categoria, orden)
select t.id, v.nombre, v.descripcion, 'Hamburguesas', v.orden
from t, (values
  ('AMERICAN CLICKS', 'Carne, doble queso, bacon, lechuga, tomate, cebolla y aderezo clicks', 0),
  ('CHEESEBURGER',    'Carne, doble queso, doble bacon y mayonesa', 1),
  ('CUARTO CLICKS',   'Carne, doble queso, bacon, ketchup, mostaza y cebolla brunoise', 2)
) as v(nombre, descripcion, orden)
on conflict do nothing;
