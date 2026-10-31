import type { Database } from "@/types/db.types";
import type { Categoria, MenuItem, MenuVariant } from "@/types/domain";

type ItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
type VariantRow = Database["public"]["Tables"]["menu_variants"]["Row"];
type CategoriaRow = Database["public"]["Tables"]["categorias"]["Row"];

export function mapCategoria(row: CategoriaRow): Categoria {
  return { id: row.id, tenantId: row.tenant_id, nombre: row.nombre, orden: row.orden };
}

function mapVariant(row: VariantRow): MenuVariant {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    label: row.label,
    precio: Number(row.precio),
    orden: row.orden,
  };
}

/**
 * Combina items + variantes + categorías en el modelo de dominio, ordenando
 * por (orden de categoría, orden del item) para respetar el orden manual.
 */
export function mapMenu(
  items: ItemRow[],
  variants: VariantRow[],
  categorias: CategoriaRow[],
): MenuItem[] {
  const byItem = new Map<string, MenuVariant[]>();
  for (const v of variants) {
    const list = byItem.get(v.menu_item_id) ?? [];
    list.push(mapVariant(v));
    byItem.set(v.menu_item_id, list);
  }
  const catById = new Map(categorias.map((c) => [c.id, c]));

  const mapped = items.map((row) => {
    const cat = row.categoria_id ? catById.get(row.categoria_id) : undefined;
    const item: MenuItem = {
      id: row.id,
      tenantId: row.tenant_id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      precio: row.precio != null ? Number(row.precio) : null,
      categoria: cat?.nombre ?? row.categoria,
      categoriaId: row.categoria_id ?? null,
      imagenUrl: row.imagen_url,
      activo: row.activo,
      destacado: row.destacado,
      // La columna llega con la migración 0020; antes de aplicarla vale null.
      vigenteHasta: row.vigente_hasta ?? null,
      orden: row.orden,
      variantes: (byItem.get(row.id) ?? []).sort((a, b) => a.orden - b.orden),
    };
    return { item, ordenCat: cat?.orden ?? Number.MAX_SAFE_INTEGER };
  });

  mapped.sort(
    (a, b) =>
      a.ordenCat - b.ordenCat ||
      a.item.orden - b.item.orden ||
      a.item.nombre.localeCompare(b.item.nombre),
  );
  return mapped.map((x) => x.item);
}

/** Agrupa items por categoría preservando el orden de aparición. */
export function groupByCategoria(items: MenuItem[]): { categoria: string; items: MenuItem[] }[] {
  const grupos: { categoria: string; items: MenuItem[] }[] = [];
  for (const item of items) {
    let g = grupos.find((x) => x.categoria === item.categoria);
    if (!g) {
      g = { categoria: item.categoria, items: [] };
      grupos.push(g);
    }
    g.items.push(item);
  }
  return grupos;
}
