import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/services/supabase/public";
import { mapTenant } from "../mappers";
import { carruselConfigFromJson } from "@/features/menu/carrusel";
import type { Tenant } from "@/types/domain";

/** Tag de caché del tenant — usar con revalidateTag al editar branding. */
export const tenantTag = (slug: string) => `tenant:${slug}`;

/**
 * Resuelve un tenant activo por slug. Cacheado entre requests (revalida cada
 * 30s o al invalidar el tag), usando el cliente público sin cookies.
 */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const tenant = await unstable_cache(
    async () => {
      const supabase = createSupabasePublicClient();
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug)
        .eq("activo", true)
        .maybeSingle();
      if (error || !data) return null;
      return mapTenant(data);
    },
    // "v2": las entradas guardadas antes del carrusel no tienen ese campo.
    ["tenant-by-slug-v2", slug],
    { revalidate: 30, tags: [tenantTag(slug)] },
  )();
  // La caché (local o de Vercel) puede traer datos de una versión anterior:
  // se completan los campos nuevos para que la carta nunca falle por eso.
  return tenant ? { ...tenant, carrusel: tenant.carrusel ?? carruselConfigFromJson(null) } : null;
}
