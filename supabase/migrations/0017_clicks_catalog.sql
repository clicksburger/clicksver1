-- Carta Clicks verificada en Pedix el 2026-10-29. Generada por scripts/prepare-clicks-catalog.mjs.
-- Conserva IDs de productos y variantes existentes. No borra pedidos ni productos.
begin;
do $$
declare
  business_id uuid; category_id uuid; product_id uuid; variant_id uuid;
  product jsonb; variant jsonb; category_name text; aliases text[];
  candidates uuid[]; labels text[]; prices numeric[]; i int; product_order int := 0;
begin
  select id into strict business_id from public.tenants where slug = 'clicks-burger';
  for product in select value from jsonb_array_elements('[{"nombre":"CHEESEBURGER","categoria":"Hamburguesas","descripcion":"Carne, doble queso cheddar, ketchup, mayonesa Clicks y cebolla brunoise. Incluye papas.","imagen":"/img/cheeseburger.jpg","precios":[11000,14000,17000]},{"nombre":"AMERICAN CLICKS","categoria":"Hamburguesas","descripcion":"Carne, doble queso cheddar, bacon, lechuga, tomate, cebolla y aderezo Clicks. Incluye papas.","imagen":"/img/american-clicks.jpg","precios":[11500,14500,17500]},{"nombre":"CUARTO CLICKS","categoria":"Hamburguesas","descripcion":"Carne, doble queso cheddar, ketchup, mostaza y cebolla brunoise. Incluye papas.","imagen":"/img/cuarto-clicks.jpg","precios":[11000,14000,17000]},{"nombre":"CRISPY CLICKS","categoria":"Hamburguesas","descripcion":"Carne, doble queso, bacon, cebolla crispy y barbacoa. Incluye papas.","imagen":"/img/crispy-clicks.png","precios":[11500,14500,17500]},{"nombre":"GOLDEN ONION CLICKS","categoria":"Hamburguesas","descripcion":"Carne, queso cheddar, cebolla grillada junto al blend y mayonesa Clicks. Incluye papas.","imagen":"/img/golden-onion-clicks.png","precios":[11000,14000,17000]},{"nombre":"SUPREME BACON CLICKS","categoria":"Hamburguesas","descripcion":"Carne, doble queso cheddar, triple bacon y mayonesa Clicks. Incluye papas.","imagen":null,"precios":[11500,14500,17500]},{"nombre":"PAPAS FRITAS","aliases":["Porción de Papas"],"categoria":"Extras","descripcion":"Porción de papas fritas salpimentadas de 150 g.","imagen":"/img/papas-fritas.png","precio":3500},{"nombre":"BONIATOS","categoria":"Extras","descripcion":"Porción de boniatos salpimentados de 150 g.","imagen":"/img/boniatos.png","precio":3500},{"nombre":"DIP DE SALSAS","aliases":["Mayonesa"],"categoria":"Extras","descripcion":"Personalizá tu dip con las salsas que quieras. Las opciones aplican a cada unidad agregada.","imagen":"/img/dip-salsas.png","precio":500,"opciones":["Mayo Clicks","Salsa Clicks","Ketchup","Barbacoa","Mostaza"]},{"nombre":"COCA COLA LATA 354ML","aliases":["Coca-Cola"],"categoria":"Bebidas","descripcion":"Lata de 354 ml.","imagen":"/img/latacoca.jpg","precio":2500},{"nombre":"SPRITE LATA 354ML","aliases":["Sprite"],"categoria":"Bebidas","descripcion":"Lata de 354 ml.","imagen":"/img/latasprite.jpg","precio":2500},{"nombre":"PEPSI LATA 354ML","categoria":"Bebidas","descripcion":"Lata de 354 ml.","imagen":null,"precio":2500},{"nombre":"COCA COLA ZERO LATA 354ML","aliases":["Coca Zero"],"categoria":"Bebidas","descripcion":"Lata de 354 ml.","imagen":"/img/latacocazero.jpg","precio":2500}]'::jsonb) loop
    category_name := product->>'categoria';
    select id into category_id from public.categorias where tenant_id = business_id and lower(nombre) = lower(category_name);
    if category_id is null then
      insert into public.categorias(tenant_id,nombre,orden) values(business_id,category_name,case category_name when 'Hamburguesas' then 0 when 'Extras' then 1 else 2 end) returning id into category_id;
    end if;
    select array_agg(lower(value)) into aliases from jsonb_array_elements_text(coalesce(product->'aliases','[]'::jsonb));
    select array_agg(id) into candidates from public.menu_items where tenant_id = business_id
      and (lower(nombre) = lower(product->>'nombre') or lower(nombre) = any(aliases));
    if coalesce(array_length(candidates,1),0) > 1 then raise exception 'Productos duplicados para %: revisar antes de importar',product->>'nombre'; end if;
    product_id := candidates[1];
    if product_id is null then
      insert into public.menu_items(tenant_id,nombre,categoria,categoria_id) values(business_id,product->>'nombre',category_name,category_id) returning id into product_id;
    end if;
    update public.menu_items set nombre=product->>'nombre',descripcion=product->>'descripcion',categoria=category_name,categoria_id=category_id,
      precio=case when product ? 'precios' or product ? 'opciones' then null else (product->>'precio')::numeric end,
      imagen_url=product->>'imagen',activo=true,orden=product_order where id=product_id and tenant_id=business_id;
    product_order := product_order + 1;
    labels := array[]::text[]; prices := array[]::numeric[];
    if product ? 'precios' then
      labels := array['Simple','Doble','Triple'];
      select array_agg(value::numeric) into prices from jsonb_array_elements_text(product->'precios');
    elsif product ? 'opciones' then
      select array_agg(value) into labels from jsonb_array_elements_text(product->'opciones');
      prices := array_fill((product->>'precio')::numeric,array[array_length(labels,1)]);
    end if;
    for i in 1..coalesce(array_length(labels,1),0) loop
      select array_agg(id) into candidates from public.menu_variants where tenant_id=business_id and menu_item_id=product_id and lower(label)=lower(labels[i]);
      if coalesce(array_length(candidates,1),0)>1 then raise exception 'Variantes duplicadas para %',product->>'nombre'; end if;
      variant_id := candidates[1];
      if variant_id is null then
        insert into public.menu_variants(tenant_id,menu_item_id,label,precio,orden) values(business_id,product_id,labels[i],prices[i],i-1);
      else
        update public.menu_variants set label=labels[i],precio=prices[i],orden=i-1 where id=variant_id and tenant_id=business_id;
      end if;
    end loop;
    -- No borrar opciones desconocidas silenciosamente: exige revisión y revierte.
    if exists(select 1 from public.menu_variants where tenant_id=business_id and menu_item_id=product_id and not(lower(label)=any(select lower(x) from unnest(labels) x))) then
      raise exception 'Hay variantes adicionales en %: revisar antes de importar',product->>'nombre';
    end if;
  end loop;
  -- Fanta ya no figura en la carta compartida; se conserva en la base como inactiva.
  update public.menu_items set activo=false where tenant_id=business_id and lower(nombre) in ('fanta','fanta lata 354ml');
end $$;
commit;
