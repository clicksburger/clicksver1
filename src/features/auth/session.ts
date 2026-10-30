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
export const getStaffSession = cache(async (tenantId: string): Promise<StaffSession | null> => {
  const supabase = await createSupabaseServerClient();
  // En paralelo: antes eran dos viajes seguidos a Supabase en cada cambio de
  // sección. RLS ya limita las membresías visibles a las del propio usuario
  // (o a todas si es superadmin); se elige la suya cuando llega getUser().
  const [
    {
      data: { user },
    },
    { data: rows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("memberships").select("user_id,rol").eq("tenant_id", tenantId),
  ]);
  if (!user) return null;

  const pick = (list: unknown) =>
    (list as { user_id: string; rol: RolStaff }[] | null)?.find((row) => row.user_id === user.id);
  let membership = pick(rows);
  if (!membership) {
    // Si el token estaba por vencer, la consulta paralela pudo salir sin sesión;
    // getUser() ya lo renovó, así que se reintenta una vez antes de rechazar.
    const { data: retry } = await supabase
      .from("memberships")
      .select("user_id,rol")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id);
    membership = pick(retry);
  }
  if (!membership) return null;
  return { userId: user.id, email: user.email ?? null, tenantId, rol: membership.rol };
});

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
