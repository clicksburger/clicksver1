import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const catalog = JSON.parse(
  fs.readFileSync(new URL("./clicks-catalog.json", import.meta.url), "utf8"),
);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const checked = (result) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const tenant = checked(await db.from("tenants").select("id").eq("slug", "clicks-burger").single());
const snapshot = {};
for (const table of ["menu_items", "menu_variants", "categorias"])
  snapshot[table] = checked(await db.from(table).select("*").eq("tenant_id", tenant.id));
const normalize = (name) => name.trim().toLocaleLowerCase("es-AR");
const products = [],
  variants = [];
for (const [order, product] of catalog.entries()) {
  const names = [product.nombre, ...(product.aliases ?? [])].map(normalize);
  const matches = snapshot.menu_items.filter((item) => names.includes(normalize(item.nombre)));
  if (matches.length > 1) throw new Error(`Productos duplicados: ${product.nombre}`);
  const categories = snapshot.categorias.filter(
    (category) => normalize(category.nombre) === normalize(product.categoria),
  );
  if (categories.length !== 1) throw new Error(`Revisar categoría: ${product.categoria}`);
  const id = matches[0]?.id ?? randomUUID();
  const labels = product.precios ? ["Simple", "Doble", "Triple"] : (product.opciones ?? []);
  const existing = snapshot.menu_variants.filter((variant) => variant.menu_item_id === id);
  if (existing.some((variant) => !labels.map(normalize).includes(normalize(variant.label))))
    throw new Error(`Variantes adicionales: ${product.nombre}`);
  products.push({
    id,
    tenant_id: tenant.id,
    nombre: product.nombre,
    descripcion: product.descripcion,
    categoria: product.categoria,
    categoria_id: categories[0].id,
    precio: labels.length ? null : product.precio,
    imagen_url: product.imagen,
    activo: true,
    orden: order,
    destacado: matches[0]?.destacado ?? false,
  });
  for (const [index, label] of labels.entries()) {
    const previous = existing.filter((variant) => normalize(variant.label) === normalize(label));
    if (previous.length > 1) throw new Error(`Variante duplicada: ${product.nombre} ${label}`);
    variants.push({
      id: previous[0]?.id ?? randomUUID(),
      tenant_id: tenant.id,
      menu_item_id: id,
      label,
      precio: product.precios?.[index] ?? product.precio,
      orden: index,
    });
  }
}
console.log(
  `Plan: ${products.length} productos, ${variants.length} opciones. Conserva IDs existentes; Fanta pasa a inactiva.`,
);
if (!process.argv.includes("--apply")) process.exitCode = 0;
else {
  const directory = path.resolve("../../output");
  fs.mkdirSync(directory, { recursive: true });
  const backup = path.join(directory, `clicks-catalog-backup-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify({ tenantId: tenant.id, ...snapshot }, null, 2));
  console.log(`Respaldo guardado: ${backup}`);
  // Cada lote es atómico en Postgres; ante un error se conserva el respaldo para recuperación.
  checked(await db.from("menu_items").upsert(products, { onConflict: "id" }));
  checked(await db.from("menu_variants").upsert(variants, { onConflict: "id" }));
  const previousFanta = snapshot.menu_items
    .filter((item) => ["fanta", "fanta lata 354ml"].includes(normalize(item.nombre)))
    .map((item) => item.id);
  if (previousFanta.length)
    checked(
      await db
        .from("menu_items")
        .update({ activo: false })
        .eq("tenant_id", tenant.id)
        .in("id", previousFanta),
    );
  const saved = checked(
    await db
      .from("menu_items")
      .select("id,nombre,activo,imagen_url,precio")
      .eq("tenant_id", tenant.id)
      .in(
        "id",
        products.map((product) => product.id),
      ),
  );
  if (saved.length !== products.length || saved.some((item) => !item.activo))
    throw new Error("La verificación del catálogo no coincide con el plan.");
  const savedVariants = checked(
    await db
      .from("menu_variants")
      .select("id,precio")
      .eq("tenant_id", tenant.id)
      .in(
        "id",
        variants.map((variant) => variant.id),
      ),
  );
  if (
    savedVariants.length !== variants.length ||
    variants.some(
      (variant) =>
        !savedVariants.some(
          (savedVariant) =>
            savedVariant.id === variant.id && Number(savedVariant.precio) === variant.precio,
        ),
    )
  )
    throw new Error("No coinciden los precios guardados.");
  console.log("Carta guardada y verificada en Supabase.");
}
