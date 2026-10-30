"use server";

import { revalidateTag } from "next/cache";
import { getStaffSession } from "@/features/auth/session";
import { createSupabaseServerClient } from "@/services/supabase/server";
import { createSupabaseAdminClient } from "@/services/supabase/admin";
import { tenantTag } from "@/features/tenants/services/tenants.service";
import type { CotizacionEnvio, TramoEnvio } from "@/types/domain";
import { envioConfigFromJson, envioConfigToJson, normalizarTramos } from "./tarifas";
import { geocodificar, geocodingDisponible } from "./geocoding.server";
import { cotizarEnvio } from "./cotizar.server";

async function soloAdmin(tenantId: string) {
  const session = await getStaffSession(tenantId);
  if (!session || session.rol !== "admin")
    throw new Error("Solo un administrador puede hacer esto.");
}

export interface GuardarEnvioResultado {
  ok: boolean;
  mensaje: string;
  ubicacionLocal: string | null;
}

/** Guarda dirección del local y tramos. Ubica el local en el mapa si la dirección cambió. */
export async function guardarEnvioConfig(
  tenantId: string,
  slug: string,
  input: { direccion: string; tramos: TramoEnvio[] },
): Promise<GuardarEnvioResultado> {
  await soloAdmin(tenantId);
  const direccion = input.direccion.trim().slice(0, 240);
  const tramos = normalizarTramos(input.tramos);
  if (direccion.length < 5)
    return { ok: false, mensaje: "Ingresá la dirección del local.", ubicacionLocal: null };
  if (!tramos.length)
    return { ok: false, mensaje: "Cargá al menos un tramo de envío.", ubicacionLocal: null };

  const supabase = await createSupabaseServerClient();
  const { data: actual } = await supabase
    .from("tenants")
    .select("envio_config")
    .eq("id", tenantId)
    .single();
  const previa = envioConfigFromJson(actual?.envio_config);
  let lat = previa?.direccion === direccion ? previa.lat : null;
  let lng = previa?.direccion === direccion ? previa.lng : null;
  let ubicacionLocal: string | null = null;
  let aviso = "";
  if (lat == null || lng == null) {
    const origen = await geocodificar(direccion);
    if (origen.ok) {
      lat = origen.punto.lat;
      lng = origen.punto.lng;
      ubicacionLocal = origen.punto.direccion;
    } else
      aviso = geocodingDisponible()
        ? " No se pudo ubicar la dirección del local en el mapa: revisala."
        : " Falta configurar GOOGLE_MAPS_API_KEY: hasta entonces los envíos quedan a confirmar.";
  }

  const { error } = await supabase
    .from("tenants")
    .update({ envio_config: envioConfigToJson({ direccion, lat, lng, tramos }) })
    .eq("id", tenantId);
  if (error) return { ok: false, mensaje: error.message, ubicacionLocal: null };
  revalidateTag(tenantTag(slug));
  return { ok: !aviso, mensaje: `Guardado.${aviso}`, ubicacionLocal };
}

/** Prueba cuánto saldría el envío a una dirección (para calibrar los tramos). */
export async function probarEnvio(tenantId: string, direccion: string): Promise<CotizacionEnvio> {
  await soloAdmin(tenantId);
  const db = createSupabaseAdminClient();
  const { data: tenant, error } = await db
    .from("tenants")
    .select("id,envio_config")
    .eq("id", tenantId)
    .single();
  if (error || !tenant) throw new Error("No se pudo leer la configuración.");
  return cotizarEnvio(db, tenant, direccion.trim().slice(0, 240));
}
