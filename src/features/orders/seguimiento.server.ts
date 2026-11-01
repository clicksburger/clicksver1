import "server-only";

import { createSupabaseAdminClient } from "@/services/supabase/admin";
import { BUSINESS_SLUG } from "@/constants/business";
import { ESTADOS, type EstadoPedido } from "@/constants/order-states";
import type { PedidoItem, TipoPedido } from "@/types/domain";
import { readCheckout } from "./checkout";
import type { SeguimientoPedido } from "./seguimiento";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Número de WhatsApp del local (el mismo que usa el checkout). */
export const whatsappLocal = () =>
  (process.env.CLICKS_WHATSAPP_NUMBER ?? "543518737099").replace(/\D/g, "");

/**
 * Lee un pedido de Clicks por su id para el seguimiento público. El id es un
 * UUID aleatorio que solo conoce quien hizo el pedido (es el requestId del
 * checkout). Devuelve null si no existe o el id no tiene formato válido.
 */
export async function obtenerSeguimiento(id: string): Promise<SeguimientoPedido | null> {
  if (!UUID.test(id)) return null;
  const db = createSupabaseAdminClient();
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .select("id")
    .eq("slug", BUSINESS_SLUG)
    .single();
  if (tenantError || !tenant) throw new Error("No se pudo consultar el local.");
  const { data, error } = await db
    .from("pedidos")
    // "*" para no fallar si todavía no existe hora_listo (migración 0022).
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (error) throw new Error("No se pudo consultar el pedido.");
  if (!data) return null;
  const items = Array.isArray(data.items) ? (data.items as unknown as PedidoItem[]) : [];
  const checkout = readCheckout(items);
  const estado = (ESTADOS as readonly string[]).includes(data.estado)
    ? (data.estado as EstadoPedido)
    : "nuevo";
  return {
    id: data.id,
    num: data.num,
    nombre: data.nombre?.trim().split(/\s+/)[0] || null,
    estado,
    tipo: data.tipo as TipoPedido,
    // Sin los datos de contacto que viajan dentro del primer ítem.
    items: items.map((item) => ({
      nombre: item.nombre,
      variante: item.variante ?? null,
      cantidad: item.cantidad,
      precio: Number(item.precio),
    })),
    costoEnvio: data.costo_envio == null ? null : Number(data.costo_envio),
    pago: checkout?.pago ?? null,
    demora: data.demora,
    creadoEn: data.creado_en,
    horaConfirmado: data.hora_confirmado,
    horaListo: data.hora_listo ?? null,
    horaEntregado: data.hora_entregado,
    whatsapp: whatsappLocal(),
  };
}
