import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { mapCategoria, mapMenu } from "../mappers";
import { uploadAsset } from "@/features/tenants/services/storage.client";
import type { Categoria, MenuItem } from "@/types/domain";

export interface VariantInput {
  label: string;
  precio: number;
}

export interface ProductInput {
  nombre: string;
  descripcion: string | null;
  categoria: string;
  categoriaId: string | null;
  precio: number | null;
  imagenUrl: string | null;
  activo: boolean;
  destacado: boolean;
  /**
   * Último día en que se ofrece (YYYY-MM-DD) o null. undefined = no tocar la
   * columna (así se puede editar el menú aunque falte la migración 0020).
   */
  vigenteHasta?: string | null;
  orden: number;
  variantes: VariantInput[];
}

/** Menú completo de un tenant (incluye inactivos) — para el panel admin. */
export async function fetchMenuAll(tenantId: string): Promise<MenuItem[]> {
  const supabase = createSupabaseBrowserClient();
  const [itemsRes, variantsRes, catsRes] = await Promise.all([
    supabase.from("menu_items").select("*").eq("tenant_id", tenantId).order("orden"),
    supabase.from("menu_variants").select("*").eq("tenant_id", tenantId).order("orden"),
    supabase.from("categorias").select("*").eq("tenant_id", tenantId).order("orden"),
  ]);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return mapMenu(itemsRes.data ?? [], variantsRes.data ?? [], catsRes.data ?? []);
}

// ── Categorías ───────────────────────────────────────────────
export async function listCategorias(tenantId: string): Promise<Categoria[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("orden");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCategoria);
}

export async function createCategoria(
  tenantId: string,
  nombre: string,
  orden: number,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("categorias")
    .insert({ tenant_id: tenantId, nombre, orden });
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una categoría con ese nombre.");
    throw new Error(error.message);
  }
}

export async function renameCategoria(id: string, nombre: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("categorias").update({ nombre }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una categoría con ese nombre.");
    throw new Error(error.message);
  }
}

export async function setCategoriaOrden(id: string, orden: number): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("categorias").update({ orden }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategoria(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) {
    if (error.code === "23503")
      throw new Error("No se puede eliminar: la categoría tiene productos asignados.");
    throw new Error(error.message);
  }
}

// ── Productos ────────────────────────────────────────────────
async function syncVariants(tenantId: string, menuItemId: string, variantes: VariantInput[]) {
  const supabase = createSupabaseBrowserClient();
  await supabase.from("menu_variants").delete().eq("menu_item_id", menuItemId);
  if (variantes.length > 0) {
    const { error } = await supabase.from("menu_variants").insert(
      variantes.map((v, i) => ({
        menu_item_id: menuItemId,
        tenant_id: tenantId,
        label: v.label,
        precio: v.precio,
        orden: i,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

export async function createMenuItem(tenantId: string, input: ProductInput): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      tenant_id: tenantId,
      nombre: input.nombre,
      descripcion: input.descripcion,
      categoria: input.categoria,
      categoria_id: input.categoriaId,
      precio: input.variantes.length > 0 ? null : input.precio,
      imagen_url: input.imagenUrl,
      activo: input.activo,
      destacado: input.destacado,
      ...(input.vigenteHasta !== undefined && { vigente_hasta: input.vigenteHasta }),
      orden: input.orden,
    })
    .select("id")
    .single();
  const row = data as { id: string } | null;
  if (error || !row) throw new Error(error?.message ?? "No se pudo crear el producto");

  await syncVariants(tenantId, row.id, input.variantes);
  return row.id;
}

export async function updateMenuItem(
  tenantId: string,
  id: string,
  input: ProductInput,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("menu_items")
    .update({
      nombre: input.nombre,
      descripcion: input.descripcion,
      categoria: input.categoria,
      categoria_id: input.categoriaId,
      precio: input.variantes.length > 0 ? null : input.precio,
      imagen_url: input.imagenUrl,
      activo: input.activo,
      destacado: input.destacado,
      ...(input.vigenteHasta !== undefined && { vigente_hasta: input.vigenteHasta }),
      orden: input.orden,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await syncVariants(tenantId, id, input.variantes);
}

export async function deleteMenuItem(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setMenuItemActivo(id: string, activo: boolean): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("menu_items").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadProductImage(
  tenantId: string,
  itemId: string,
  file: File,
): Promise<string> {
  return uploadAsset(tenantId, "products", itemId, file);
}

export async function setMenuItemImage(id: string, url: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("menu_items").update({ imagen_url: url }).eq("id", id);
  if (error) throw new Error(error.message);
}
