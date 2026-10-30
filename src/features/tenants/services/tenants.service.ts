import { unstable_cache } from "next/cache";
import { createSupabasePublicClient } from "@/services/supabase/public";
import { mapTenant } from "../mappers";
import type { Tenant } from "@/types/domain";

/** Tag de caché del tenant — usar con revalidateTag al editar branding. */
export const tenantTag = (slug: string) => `tenant:${slug}`;

/**
 * Resuelve un tenant activo por slug. Cacheado entre requests (revalida cada
 * 30s o al invalidar el tag), usando el cliente público sin cookies.
 */
export function getTenantBySlug(slug: string): Promise<Tenant | null> {
  return unstable_cache(
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
    ["tenant-by-slug", slug],
    { revalidate: 30, tags: [tenantTag(slug)] },
  )();
}
