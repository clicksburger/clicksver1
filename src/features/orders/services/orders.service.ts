import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { mapPedido } from "../mappers";
import type { Database, Json } from "@/types/db.types";
import type { Pedido, PedidoItem, TipoPedido } from "@/types/domain";

type PedidoUpdate = Database["public"]["Tables"]["pedidos"]["Update"];

/**
 * Ventana (en horas) de pedidos ENTREGADOS que cargan las boards.
 * Los pedidos activos se cargan siempre; los entregados solo dentro de esta
 * ventana móvil para que el historial no crezca sin techo en memoria/red.
 * Los datos no se borran: los entregados viejos siguen en la base.
 */
const VENTANA_ENTREGADOS_HORAS = 24;

// ── Público: crear pedido (cliente anónimo) ─────────────────
export interface NuevoPedidoInput {
  tenantId: string;
  nombre: string | null;
  tipo: TipoPedido;
  items: PedidoItem[];
}

export async function createPedido(input: NuevoPedidoInput): Promise<number> {
  const supabase = createSupabaseBrowserClient();

  // Creación atómica: la función serializa la numeración por tenant (advisory
  // lock) e inserta en una sola transacción. Sin race entre número e insert.
  const { data: num, error } = await supabase.rpc("crear_pedido", {
    p_tenant_id: input.tenantId,
    p_tipo: input.tipo,
    p_nombre: input.nombre,
    p_items: input.items as unknown as Json,
  });
  if (error || num == null) {
    throw new Error(error?.message ?? "No se pudo crear el pedido");
  }

  return num;
}

// ── Staff: leer / actualizar / eliminar (requiere membership) ──
export async function fetchPedidos(tenantId: string): Promise<Pedido[]> {
  const supabase = createSupabaseBrowserClient();
  const desde = new Date(Date.now() - VENTANA_ENTREGADOS_HORAS * 3600000).toISOString();
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("tenant_id", tenantId)
    // Activos siempre (estado distinto de entregado) + entregados de las últimas 24h.
    .or(`estado.neq.entregado,creado_en.gte.${desde}`)
    .order("num", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPedido);
}

export async function updatePedido(id: string, patch: PedidoUpdate): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("pedidos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePedido(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("pedidos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function clearPedidos(tenantId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("pedidos").delete().eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}
