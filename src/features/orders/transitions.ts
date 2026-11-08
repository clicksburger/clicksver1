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
  extra?: { demora?: number },
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
  return patch;
}
