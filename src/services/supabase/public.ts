import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db.types";
import { env } from "@/lib/env";

/**
 * Cliente anónimo SIN cookies, para lecturas públicas (branding del tenant,
 * menú). Al no depender de cookies, su resultado puede cachearse con
 * unstable_cache y la página no se vuelve dinámica por la sesión.
 */
export function createSupabasePublicClient() {
  return createClient<Database>(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
