/** Máquina de estados del pedido — fuente de verdad única. */
export const ESTADOS = ["nuevo", "confirmado", "en_cocina", "listo", "entregado", "rechazado"] as const;

export type EstadoPedido = (typeof ESTADOS)[number];

/**
 * Transiciones permitidas desde cada estado.
 * Flujo: nuevo → (Confirmar en Caja) → en_cocina → listo → entregado.
 * "confirmado" quedó deprecado (Caja confirma directo a cocina); se conserva
 * solo por compatibilidad con datos antiguos.
 */
export const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
  nuevo: ["en_cocina", "rechazado"],
  confirmado: ["en_cocina"], // back-compat: pedidos viejos van directo a cocina
  en_cocina: ["listo"],
  listo: ["entregado", "en_cocina"], // "en_cocina" = reabrir
  entregado: [],
  rechazado: [],
};

export const ESTADO_LABEL: Record<EstadoPedido, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  en_cocina: "En cocina",
  listo: "Listo",
  entregado: "Entregado",
  rechazado: "Rechazado",
};

export function puedeTransicionar(desde: EstadoPedido, hacia: EstadoPedido): boolean {
  return TRANSICIONES[desde].includes(hacia);
}
