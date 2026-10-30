import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db.types";
import { env } from "@/lib/env";

/**
 * Cliente con service role: SALTEA RLS. Usar exclusivamente en operaciones
 * de plataforma y checkout validado en el servidor. Nunca en cliente.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
