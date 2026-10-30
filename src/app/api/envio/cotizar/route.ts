import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/services/supabase/admin";
import { BUSINESS_SLUG } from "@/constants/business";
import { cotizarEnvio } from "@/features/envios/cotizar.server";

export const runtime = "nodejs";

const schema = z.object({ direccion: z.string().trim().min(5).max(240) });

// Límite simple por IP para que nadie agote la cuota de Google desde afuera.
// Es en memoria (por instancia): alcanza como freno; el tope real se configura en Google Cloud.
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 25;
const consultas = new Map<string, number[]>();
function permitido(ip: string) {
  const ahora = Date.now();
  const recientes = (consultas.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) return false;
  recientes.push(ahora);
  consultas.set(ip, recientes);
  if (consultas.size > 5000) consultas.delete(consultas.keys().next().value!);
  return true;
}

export async function POST(request: Request) {
  const error = (message: string, status: number) =>
    NextResponse.json({ error: message }, { status });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return error("Origen no permitido.", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!permitido(ip))
    return error("Demasiadas consultas seguidas. Esperá unos minutos e intentá de nuevo.", 429);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error("Consulta inválida.", 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return error("Ingresá calle y altura de la dirección de entrega.", 400);

  const db = createSupabaseAdminClient();
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("id,envio_config")
    .eq("slug", BUSINESS_SLUG)
    .eq("activo", true)
    .single();
  if (tenantError || !tenant) return error("No se pudo consultar el local.", 503);

  const cotizacion = await cotizarEnvio(db, tenant, parsed.data.direccion);
  return NextResponse.json(cotizacion, { headers: { "Cache-Control": "no-store" } });
}
