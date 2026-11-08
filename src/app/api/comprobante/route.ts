import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase/admin";
import { BUSINESS_SLUG } from "@/constants/business";
import {
  BUCKET_COMPROBANTES,
  MAX_COMPROBANTE_BYTES,
  TIPOS_COMPROBANTE,
  rutaComprobante,
} from "@/features/orders/comprobante.server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Freno simple por IP (en memoria, por instancia).
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 15;
const subidas = new Map<string, number[]>();
function permitido(ip: string) {
  const ahora = Date.now();
  const recientes = (subidas.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) return false;
  recientes.push(ahora);
  subidas.set(ip, recientes);
  if (subidas.size > 5000) subidas.delete(subidas.keys().next().value!);
  return true;
}

/**
 * Sube el comprobante de transferencia de un pedido (opcional en el checkout).
 * Se guarda con el id del pedido; al confirmar, el checkout lo encuentra y
 * agrega el link al mensaje de WhatsApp.
 */
export async function POST(request: Request) {
  const error = (mensaje: string, status: number) =>
    NextResponse.json({ error: mensaje }, { status });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return error("Origen no permitido.", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!permitido(ip)) return error("Demasiados archivos seguidos. Esperá unos minutos.", 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("No se recibió el archivo.", 400);
  }
  const pedidoId = String(form.get("pedidoId") ?? "");
  const archivo = form.get("archivo");
  if (!UUID.test(pedidoId) || !(archivo instanceof File)) return error("Datos inválidos.", 400);
  if (archivo.size === 0 || archivo.size > MAX_COMPROBANTE_BYTES)
    return error("El comprobante tiene que pesar menos de 4 MB.", 413);
  if (!TIPOS_COMPROBANTE.includes(archivo.type))
    return error("Subí una foto o captura (JPG, PNG) o un PDF.", 415);

  const db = createSupabaseAdminClient();
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", BUSINESS_SLUG).single();
  if (!tenant) return error("No se pudo consultar el local.", 503);
  const { error: uploadError } = await db.storage
    .from(BUCKET_COMPROBANTES)
    .upload(rutaComprobante(tenant.id, pedidoId), archivo, {
      contentType: archivo.type,
      upsert: true,
    });
  if (uploadError) return error("No se pudo guardar el comprobante.", 503);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
