"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getStaffSession } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/services/supabase/admin";
import { tenantTag } from "@/features/tenants/services/tenants.service";
import {
  carruselConfigFromJson,
  carruselConfigToJson,
  type CarruselConfig,
  type ModoCarrusel,
} from "./carrusel";

export interface ResultadoCarrusel {
  ok: boolean;
  mensaje: string;
  config?: CarruselConfig;
}

async function permitir(tenantId: string, roles: readonly string[]) {
  const session = await getStaffSession(tenantId);
  if (!session || !roles.includes(session.rol))
    throw new Error("No tenés permiso para cambiar el carrusel.");
}

async function guardar(tenantId: string, slug: string, config: CarruselConfig) {
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from("tenants")
    .update({ carrusel_config: carruselConfigToJson(config) })
    .eq("id", tenantId);
  if (error)
    return {
      ok: false,
      mensaje: error.message.includes("carrusel_config")
        ? "Falta aplicar la migración 0023 en Supabase."
        : error.message,
    };
  // La carta lee el carrusel desde el tenant cacheado: se invalida para verlo al instante.
  revalidateTag(tenantTag(slug));
  revalidatePath("/");
  return { ok: true, mensaje: "Guardado. La carta ya muestra el carrusel elegido.", config };
}

async function configActual(tenantId: string) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (error || !data) throw new Error("No se pudo leer la configuración del local.");
  return carruselConfigFromJson(data.carrusel_config ?? null);
}

/** Configuración completa (modo, días y productos de cada carrusel). Solo administradores. */
export async function guardarCarrusel(
  tenantId: string,
  slug: string,
  input: CarruselConfig,
): Promise<ResultadoCarrusel> {
  await permitir(tenantId, ["admin"]);
  const config = carruselConfigFromJson(input);
  // Solo productos de este local.
  const db = createSupabaseAdminClient();
  const { data: items, error } = await db.from("menu_items").select("id").eq("tenant_id", tenantId);
  if (error) return { ok: false, mensaje: "No se pudieron validar los productos." };
  const validos = new Set((items ?? []).map((item) => item.id));
  config.promo = config.promo.filter((id) => validos.has(id));
  config.normal = config.normal.filter((id) => validos.has(id));
  if (config.modo === "auto" && config.promo.length && !config.diasPromo.length)
    return { ok: false, mensaje: "Elegí al menos un día para la promo automática." };
  return guardar(tenantId, slug, config);
}

/** Cambio rápido de modo desde la caja (administradores y cajeros). */
export async function cambiarModoCarrusel(
  tenantId: string,
  slug: string,
  modo: ModoCarrusel,
): Promise<ResultadoCarrusel> {
  await permitir(tenantId, ["admin", "cajero"]);
  const config = await configActual(tenantId);
  config.modo = modo === "promo" || modo === "normal" ? modo : "auto";
  return guardar(tenantId, slug, config);
}
