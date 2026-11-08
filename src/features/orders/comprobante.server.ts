import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db.types";

/** Bucket privado (migración 0025): solo el servidor lee y escribe. */
export const BUCKET_COMPROBANTES = "comprobantes";
// Vercel acepta hasta 4,5 MB por pedido a una función: se deja margen.
export const MAX_COMPROBANTE_BYTES = 4 * 1024 * 1024;
export const TIPOS_COMPROBANTE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];
/** El link del mensaje de WhatsApp dura 30 días; el de Caja, 10 minutos. */
export const VENCE_LINK_WHATSAPP_S = 30 * 24 * 3600;
export const VENCE_LINK_CAJA_S = 10 * 60;

/** Un comprobante por pedido: carpeta del local / id del pedido (el requestId). */
export const rutaComprobante = (tenantId: string, pedidoId: string) => `${tenantId}/${pedidoId}`;

type Db = SupabaseClient<Database>;

export async function existeComprobante(db: Db, tenantId: string, pedidoId: string) {
  const { data, error } = await db.storage
    .from(BUCKET_COMPROBANTES)
    .list(tenantId, { search: pedidoId, limit: 1 });
  if (error) return false;
  return (data ?? []).some((file) => file.name === pedidoId);
}

/** Link temporal para ver el comprobante; null si no se pudo firmar. */
export async function linkComprobante(db: Db, ruta: string, segundos: number) {
  const { data, error } = await db.storage
    .from(BUCKET_COMPROBANTES)
    .createSignedUrl(ruta, segundos);
  return error ? null : data.signedUrl;
}
