import type { EstadoPedido } from "@/constants/order-states";
import type { TipoPedido } from "@/types/domain";

/**
 * Lo que ve el cliente en el seguimiento de su pedido. A propósito no incluye
 * teléfono ni dirección: el link se puede reenviar y solo muestra el pedido.
 */
export interface SeguimientoPedido {
  id: string;
  num: number;
  /** Solo el primer nombre, para el saludo. */
  nombre: string | null;
  estado: EstadoPedido;
  tipo: TipoPedido;
  items: { nombre: string; variante: string | null; cantidad: number; precio: number }[];
  costoEnvio: number | null;
  pago: "efectivo" | "transferencia" | null;
  /** Minutos que cargó la caja al confirmar. */
  demora: number | null;
  creadoEn: string;
  horaConfirmado: string | null;
  /** Cuándo pasó a "listo" (migración 0022). null si no se registró. */
  horaListo: string | null;
  horaEntregado: string | null;
  /** Número del local para el botón de WhatsApp (solo dígitos). */
  whatsapp: string;
}

export type EstadoPaso = "hecho" | "actual" | "pendiente";
export interface PasoSeguimiento {
  clave: string;
  titulo: string;
  emoji?: string;
  /** Texto chico debajo del título (hora o aclaración). */
  detalle?: string;
  estado: EstadoPaso;
}

/** Ventana de tiempo para recibir o retirar el pedido (minutos). */
const MARGEN_VENTANA = 15;
const ZONA = "America/Argentina/Buenos_Aires";

export const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export const esFinal = (estado: EstadoPedido) => estado === "entregado" || estado === "rechazado";

/** Minutos después de "Listo, saliendo" en que el delivery pasa a "En camino a tu casa". */
export const EN_CAMINO_MIN = 5;

/**
 * Pasos como en las apps de delivery, atados a las pestañas de la caja:
 * Pedido enviado (Entrantes) → En preparación (En cocina) → Listo, saliendo
 * (Listos) → En camino a tu casa (solo delivery, 5 min después de listo) →
 * Entregado. Para retiro: Pedido enviado → En preparación → Listo para
 * retirar → Retirado.
 */
export function pasosSeguimiento(
  pedido: SeguimientoPedido,
  now: number = Date.now(),
): PasoSeguimiento[] {
  const delivery = pedido.tipo === "delivery";
  const enCamino =
    delivery &&
    pedido.estado === "listo" &&
    pedido.horaListo != null &&
    now - new Date(pedido.horaListo).getTime() >= EN_CAMINO_MIN * 60000;
  const base: Omit<PasoSeguimiento, "estado">[] = [
    {
      clave: "enviado",
      titulo: "Pedido enviado",
      detalle:
        pedido.estado === "nuevo" || pedido.estado === "confirmado"
          ? `${hora(pedido.creadoEn)} · Esperando que el local lo confirme`
          : hora(pedido.creadoEn),
    },
    {
      clave: "preparacion",
      titulo: "En preparación",
      emoji: "🔥",
      detalle: pedido.horaConfirmado ? `Confirmado ${hora(pedido.horaConfirmado)}` : undefined,
    },
    {
      clave: "listo",
      titulo: delivery ? "Listo, saliendo" : "¡Listo para retirar!",
      emoji: delivery ? "🛵" : "🍔",
      detalle: pedido.horaListo ? hora(pedido.horaListo) : undefined,
    },
    ...(delivery ? [{ clave: "camino", titulo: "En camino a tu casa" }] : []),
    {
      clave: "entregado",
      titulo: delivery ? "¡Entregado! Buen provecho" : "Retirado. ¡Buen provecho!",
      emoji: "😋",
      detalle: pedido.horaEntregado ? hora(pedido.horaEntregado) : undefined,
    },
  ];
  const ultimo = base.length - 1;
  const actual =
    pedido.estado === "entregado"
      ? ultimo
      : pedido.estado === "listo"
        ? enCamino
          ? 3
          : 2
        : pedido.estado === "en_cocina"
          ? 1
          : 0;
  return base.map((paso, i) => ({
    ...paso,
    estado:
      pedido.estado === "entregado" || i < actual ? "hecho" : i === actual ? "actual" : "pendiente",
  }));
}

/**
 * Cuándo llega (delivery) o cuándo se retira. Sale de la hora en que la caja
 * confirmó más la demora que cargó; null si todavía no hay datos.
 */
export function ventanaEntrega(pedido: SeguimientoPedido): { desde: string; hasta: string } | null {
  if (!pedido.horaConfirmado || pedido.demora == null) return null;
  if (pedido.estado !== "en_cocina" && pedido.estado !== "listo") return null;
  const base = new Date(pedido.horaConfirmado).getTime() + pedido.demora * 60000;
  return {
    desde: hora(new Date(base).toISOString()),
    hasta: hora(new Date(base + MARGEN_VENTANA * 60000).toISOString()),
  };
}

export const totalSeguimiento = (pedido: SeguimientoPedido) =>
  pedido.items.reduce((sum, item) => sum + item.precio * item.cantidad, 0) +
  (pedido.costoEnvio ?? 0);

/** Pedido guardado en este navegador para volver al seguimiento desde la carta. */
export const CLAVE_ULTIMO_PEDIDO = "clicks:ultimo-pedido";
export interface UltimoPedido {
  id: string;
  num: number;
  guardado: number;
}
/** El aviso en la carta se ofrece hasta 12 horas después de pedir. */
export const VIGENCIA_ULTIMO_PEDIDO_MS = 12 * 3600000;

export function leerUltimoPedido(now = Date.now()): UltimoPedido | null {
  try {
    const raw = localStorage.getItem(CLAVE_ULTIMO_PEDIDO);
    if (!raw) return null;
    const value = JSON.parse(raw) as UltimoPedido;
    if (!value?.id || now - value.guardado > VIGENCIA_ULTIMO_PEDIDO_MS) return null;
    return value;
  } catch {
    return null;
  }
}
export function guardarUltimoPedido(id: string, num: number) {
  try {
    localStorage.setItem(
      CLAVE_ULTIMO_PEDIDO,
      JSON.stringify({ id, num, guardado: Date.now() } satisfies UltimoPedido),
    );
  } catch {
    /* Navegación privada o sin almacenamiento: el link de WhatsApp sigue sirviendo. */
  }
}
export function olvidarUltimoPedido() {
  try {
    localStorage.removeItem(CLAVE_ULTIMO_PEDIDO);
  } catch {
    /* sin almacenamiento */
  }
}
