import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db.types";
import type { CotizacionEnvio, EnvioConfig } from "@/types/domain";
import { aConfirmar, cotizar, envioConfigFromJson, envioConfigToJson } from "./tarifas";
import { geocodificar } from "./geocoding.server";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];

/**
 * Devuelve la configuración con las coordenadas del local. Si todavía no
 * están (primera vez o cambió la dirección), geocodifica y las guarda.
 */
export async function configConOrigen(
  db: SupabaseClient<Database>,
  tenant: Pick<TenantRow, "id" | "envio_config">,
): Promise<(EnvioConfig & { lat: number; lng: number }) | null> {
  const config = envioConfigFromJson(tenant.envio_config);
  if (!config || !config.tramos.length) return null;
  if (config.lat != null && config.lng != null)
    return { ...config, lat: config.lat, lng: config.lng };
  const origen = await geocodificar(config.direccion);
  if (!origen.ok) return null;
  const completa = { ...config, lat: origen.punto.lat, lng: origen.punto.lng };
  const { error } = await db
    .from("tenants")
    .update({ envio_config: envioConfigToJson(completa) })
    .eq("id", tenant.id);
  if (error) console.error("[envios] No se guardaron las coordenadas del local", error.message);
  return completa;
}

/** Cotiza el envío a una dirección. Nunca lanza: ante cualquier problema queda "a confirmar". */
export async function cotizarEnvio(
  db: SupabaseClient<Database>,
  tenant: Pick<TenantRow, "id" | "envio_config">,
  direccion: string,
): Promise<CotizacionEnvio> {
  try {
    const config = await configConOrigen(db, tenant);
    if (!config) return aConfirmar("no_disponible");
    const destino = await geocodificar(direccion, config);
    if (!destino.ok) return aConfirmar(destino.motivo);
    return cotizar(config, destino.punto);
  } catch (error) {
    console.error("[envios] Error al cotizar", error);
    return aConfirmar("no_disponible");
  }
}
