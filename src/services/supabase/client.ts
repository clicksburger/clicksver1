"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/db.types";
import { env } from "@/lib/env";

/** Cliente Supabase para Client Components (usa la anon key + RLS). */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(env.supabaseUrl(), env.supabaseAnonKey());
}
