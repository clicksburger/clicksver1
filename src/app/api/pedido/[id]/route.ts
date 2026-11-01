import { NextResponse } from "next/server";
import { obtenerSeguimiento } from "@/features/orders/seguimiento.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La pantalla consulta cada 10 s; el límite frena a quien intente recorrer ids.
// En memoria (por instancia): alcanza como freno.
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 300;
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

/** Estado actual de un pedido para la pantalla de seguimiento del cliente. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!permitido(ip))
    return NextResponse.json({ error: "Demasiadas consultas." }, { status: 429, headers });
  const { id } = await params;
  try {
    const pedido = await obtenerSeguimiento(id);
    if (!pedido)
      return NextResponse.json({ error: "No encontramos ese pedido." }, { status: 404, headers });
    return NextResponse.json(pedido, { headers });
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar el pedido." },
      { status: 503, headers },
    );
  }
}
