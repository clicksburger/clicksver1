"use server";

import { getStaffSession } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/services/supabase/admin";
import type { PedidoItem } from "@/types/domain";
import { readCheckout } from "./checkout";
import { VENCE_LINK_CAJA_S, linkComprobante } from "./comprobante.server";

/** Link temporal (10 min) al comprobante de un pedido, para caja y administración. */
export async function verComprobante(tenantId: string, pedidoId: string): Promise<string> {
  const session = await getStaffSession(tenantId);
  if (!session || (session.rol !== "admin" && session.rol !== "cajero"))
    throw new Error("No tenés permiso para ver comprobantes.");
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("pedidos")
    .select("items")
    .eq("id", pedidoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) throw new Error("No se encontró el pedido.");
  const ruta = readCheckout((data.items as unknown as PedidoItem[]) ?? [])?.comprobante;
  if (!ruta) throw new Error("Este pedido no tiene comprobante adjunto.");
  const url = await linkComprobante(db, ruta, VENCE_LINK_CAJA_S);
  if (!url) throw new Error("No se pudo abrir el comprobante.");
  return url;
}
