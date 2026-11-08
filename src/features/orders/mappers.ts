import type { Database } from "@/types/db.types";
import type { EstadoPedido } from "@/constants/order-states";
import type { Pedido, PedidoItem, TipoPedido } from "@/types/domain";
import { readCheckout } from "./checkout";

export type PedidoRow = Database["public"]["Tables"]["pedidos"]["Row"];

export function mapPedido(row: PedidoRow): Pedido {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    num: row.num,
    estado: row.estado as EstadoPedido,
    tipo: row.tipo as TipoPedido,
    nombre: row.nombre,
    items: Array.isArray(row.items) ? (row.items as unknown as PedidoItem[]) : [],
    demora: row.demora,
    horaConfirmado: row.hora_confirmado,
    horaEntregado: row.hora_entregado,
    creadoEn: row.creado_en,
    costoEnvio: row.costo_envio == null ? null : Number(row.costo_envio),
    checkout: readCheckout(Array.isArray(row.items) ? (row.items as unknown as PedidoItem[]) : []),
  };
}
