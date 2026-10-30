import type {
  CotizacionEnvio,
  EnvioConfig,
  MotivoEnvioAConfirmar,
  Pedido,
  PedidoItem,
  TramoEnvio,
} from "@/types/domain";

/**
 * Reglas de envío por distancia. Funciones puras: se usan igual en el navegador
 * (para mostrar) y en el servidor (que es quien decide el precio).
 */

export const DIRECCION_LOCAL_DEFAULT = "Fray Luis Beltrán 2735, Córdoba, Argentina";

export const TRAMOS_DEFAULT: TramoEnvio[] = [
  { hastaKm: 1, costo: 1000 },
  { hastaKm: 2.5, costo: 1500 },
  { hastaKm: 3.5, costo: 2000 },
  { hastaKm: 4.5, costo: 3000 },
];

const numero = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Ordena por km y descarta tramos inválidos o repetidos. */
export function normalizarTramos(tramos: TramoEnvio[]): TramoEnvio[] {
  const vistos = new Set<number>();
  return tramos
    .filter((t) => t.hastaKm > 0 && t.hastaKm <= 100 && t.costo >= 0 && t.costo <= 1_000_000)
    .sort((a, b) => a.hastaKm - b.hastaKm)
    .filter((t) => (vistos.has(t.hastaKm) ? false : (vistos.add(t.hastaKm), true)));
}

/** JSON guardado en tenants.envio_config -> modelo. null si no hay configuración. */
export function envioConfigFromJson(json: unknown): EnvioConfig | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const tramos = Array.isArray(o.tramos)
    ? o.tramos.flatMap((t) => {
        const r = (t ?? {}) as Record<string, unknown>;
        const hastaKm = numero(r.hastaKm);
        const costo = numero(r.costo);
        return hastaKm != null && costo != null ? [{ hastaKm, costo }] : [];
      })
    : [];
  return {
    direccion:
      typeof o.direccion === "string" && o.direccion.trim()
        ? o.direccion.trim()
        : DIRECCION_LOCAL_DEFAULT,
    lat: numero(o.lat),
    lng: numero(o.lng),
    tramos: normalizarTramos(tramos),
  };
}

export function envioConfigToJson(config: EnvioConfig) {
  return {
    direccion: config.direccion,
    lat: config.lat,
    lng: config.lng,
    tramos: normalizarTramos(config.tramos).map((t) => ({ hastaKm: t.hastaKm, costo: t.costo })),
  };
}

/** Distancia en línea recta (km) entre dos coordenadas (fórmula de Haversine). */
export function distanciaKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371.0088;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Costo para una distancia, o null si supera el último tramo (envío a confirmar). */
export function costoPorDistancia(km: number, tramos: TramoEnvio[]): number | null {
  const redondeado = Math.round(km * 100) / 100;
  return normalizarTramos(tramos).find((t) => redondeado <= t.hastaKm)?.costo ?? null;
}

/** Arma la cotización a partir de la ubicación ya geocodificada del cliente. */
export function cotizar(
  config: EnvioConfig & { lat: number; lng: number },
  destino: { lat: number; lng: number; direccion: string },
): CotizacionEnvio {
  const km = Math.round(distanciaKm(config, destino) * 100) / 100;
  const costo = costoPorDistancia(km, config.tramos);
  if (costo == null)
    return {
      estado: "a_confirmar",
      motivo: "fuera_de_rango",
      costo: null,
      km,
      direccion: destino.direccion,
      lat: destino.lat,
      lng: destino.lng,
    };
  return {
    estado: "calculado",
    costo,
    km,
    direccion: destino.direccion,
    lat: destino.lat,
    lng: destino.lng,
  };
}

export function aConfirmar(motivo: MotivoEnvioAConfirmar): CotizacionEnvio {
  return {
    estado: "a_confirmar",
    motivo,
    costo: null,
    km: null,
    direccion: null,
    lat: null,
    lng: null,
  };
}

export const MOTIVO_A_CONFIRMAR: Record<MotivoEnvioAConfirmar, string> = {
  fuera_de_rango: "La dirección está fuera de nuestra zona de envío habitual.",
  no_encontrada: "No pudimos ubicar la dirección en el mapa.",
  no_disponible: "No pudimos calcular el envío en este momento.",
};

export const formatKm = (km: number) =>
  `${km.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

export const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

// ── Totales de pedidos (productos + envío) ─────────────────────────

export const totalProductos = (items: PedidoItem[]) =>
  items.reduce((sum, item) => sum + Number(item.precio) * Number(item.cantidad), 0);

/** Envío cobrado del pedido (0 si no aplica o está a confirmar). */
export const envioDe = (pedido: Pick<Pedido, "costoEnvio">) => Number(pedido.costoEnvio ?? 0);

export const totalConEnvio = (pedido: Pick<Pedido, "items" | "costoEnvio">) =>
  totalProductos(pedido.items) + envioDe(pedido);

/** Delivery cuyo costo de envío todavía no se acordó. */
export const envioPendiente = (pedido: Pick<Pedido, "tipo" | "costoEnvio">) =>
  pedido.tipo === "delivery" && pedido.costoEnvio == null;
