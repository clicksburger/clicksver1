import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/services/supabase/server";
import type { RolStaff } from "@/constants/roles";
import type { StaffSession } from "./types";

/**
 * Sesión de staff para un tenant: usuario autenticado + su rol (membership).
 * null si no está logueado o no es miembro. Cacheado por request (React.cache)
 * para no repetir getUser()+query entre el layout y la página.
 */
export const getStaffSession = cache(
  async (tenantId: string): Promise<StaffSession | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("memberships")
      .select("rol")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const membership = data as { rol: RolStaff } | null;
    if (!membership) return null;
    return { userId: user.id, email: user.email ?? null, tenantId, rol: membership.rol };
  },
);

export interface SuperadminSession {
  userId: string;
  email: string | null;
}

/** Verifica si el usuario autenticado es admin de plataforma (tabla platform_admins). */
export const getSuperadminSession = cache(async (): Promise<SuperadminSession | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;
  return { userId: user.id, email: user.email ?? null };
});
