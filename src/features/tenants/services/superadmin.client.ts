import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { mapTenant } from "../mappers";
import type { Tenant } from "@/types/domain";

export interface PlatformMetrics {
  tenantsActivos: number;
  pedidosTotal: number;
  pedidosHoy: number;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const supabase = createSupabaseBrowserClient();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [tenants, total, hoyCount] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }).eq("activo", true),
    supabase.from("pedidos").select("*", { count: "exact", head: true }),
    supabase.from("pedidos").select("*", { count: "exact", head: true }).gte("creado_en", hoy.toISOString()),
  ]);

  return {
    tenantsActivos: tenants.count ?? 0,
    pedidosTotal: total.count ?? 0,
    pedidosHoy: hoyCount.count ?? 0,
  };
}

export async function listTenants(): Promise<Tenant[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("tenants").select("*").order("creado_en");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTenant);
}

export interface TenantInput {
  slug: string;
  nombre: string;
  colorPrimario: string;
  colorFondo: string;
}

const normalizeSlug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-");

export async function createTenant(input: TenantInput): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("tenants").insert({
    slug: normalizeSlug(input.slug),
    nombre: input.nombre,
    color_primario: input.colorPrimario,
    color_fondo: input.colorFondo,
  });
  if (error) throw new Error(error.message);
}

export async function updateTenant(
  id: string,
  patch: { nombre?: string; colorPrimario?: string; colorFondo?: string },
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      ...(patch.nombre != null ? { nombre: patch.nombre } : {}),
      ...(patch.colorPrimario != null ? { color_primario: patch.colorPrimario } : {}),
      ...(patch.colorFondo != null ? { color_fondo: patch.colorFondo } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setTenantActivo(id: string, activo: boolean): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("tenants").update({ activo }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTenant(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
