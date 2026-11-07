import { puedeTransicionar, type EstadoPedido } from "@/constants/order-states";
import type { Database } from "@/types/db.types";

type PedidoUpdate = Database["public"]["Tables"]["pedidos"]["Update"];

/**
 * Calcula el patch de una transición validándola contra la máquina de estados.
 * Setea los timestamps correspondientes. Lanza si la transición no está permitida.
 */
export function transicion(
  desde: EstadoPedido,
  hacia: EstadoPedido,
  extra?: { demora?: number; motivo?: string | null },
): PedidoUpdate {
  if (!puedeTransicionar(desde, hacia)) {
    throw new Error(`Transición no permitida: ${desde} → ${hacia}`);
  }

  const patch: PedidoUpdate = { estado: hacia };
  const ahora = new Date().toISOString();

  // Confirmar (nuevo → en_cocina) registra hora de confirmación y demora.
  // Reabrir (listo → en_cocina) NO toca esos valores.
  if (hacia === "en_cocina" && desde === "nuevo") {
    patch.hora_confirmado = ahora;
    if (extra?.demora != null) patch.demora = extra.demora;
  }
  if (hacia === "entregado") {
    patch.hora_entregado = ahora;
  }
  // Rechazar: hora_rechazado la pone un trigger de la base (0025), igual que al
  // restaurar la limpia junto con el motivo. Acá solo viaja el motivo, si hay.
  if (hacia === "rechazado") {
    const motivo = extra?.motivo?.trim();
    if (motivo) patch.motivo_rechazo = motivo.slice(0, 200);
  }
  return patch;
}
