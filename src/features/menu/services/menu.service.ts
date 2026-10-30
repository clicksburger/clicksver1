import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/services/supabase/public";
import { mapMenu } from "../mappers";
import type { MenuItem } from "@/types/domain";

/** Tag de caché del menú — usar con revalidateTag al editar productos o categorías. */
export const menuTag = (tenantId: string) => `menu:${tenantId}`;

/**
 * Menú activo de un tenant (items + variantes + categorías). Cacheado entre
 * requests (revalida cada 30s o al invalidar el tag), con cliente público.
 */
export function getMenu(tenantId: string): Promise<MenuItem[]> {
  return unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient();
      const [itemsRes, variantsRes, catsRes] = await Promise.all([
        supabase
          .from("menu_items")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("activo", true)
          .order("orden"),
        supabase.from("menu_variants").select("*").eq("tenant_id", tenantId).order("orden"),
        supabase.from("categorias").select("*").eq("tenant_id", tenantId).order("orden"),
      ]);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      return mapMenu(itemsRes.data ?? [], variantsRes.data ?? [], catsRes.data ?? []);
    },
    ["menu-by-tenant", tenantId],
    { revalidate: 30, tags: [menuTag(tenantId)] },
  )();
}
