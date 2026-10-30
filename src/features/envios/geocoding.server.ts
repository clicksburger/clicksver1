import "server-only";

/**
 * Geocodificación con Google (Geocoding API). Solo servidor: la clave
 * GOOGLE_MAPS_API_KEY nunca llega al navegador.
 * Costo: 10.000 consultas gratis por mes; con una consulta por pedido sobra.
 */

export interface PuntoGeocodificado {
  lat: number;
  lng: number;
  direccion: string;
}

export type ResultadoGeocoding =
  | { ok: true; punto: PuntoGeocodificado }
  | { ok: false; motivo: "no_encontrada" | "no_disponible" };

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE = 500;
const cache = new Map<string, { at: number; value: ResultadoGeocoding }>();

/** Tipos de resultado que identifican una dirección concreta (no una calle o un barrio entero). */
const TIPOS_PRECISOS = new Set(["street_address", "premise", "subpremise", "establishment"]);

interface GoogleResult {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number }; location_type: string };
  types: string[];
}

export const geocodingDisponible = () => Boolean(process.env.GOOGLE_MAPS_API_KEY);

const clave = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Agrega ciudad y país si el cliente no los escribió, para no ubicar homónimos de otra ciudad. */
function conCiudad(direccion: string) {
  return /c[oó]rdoba/i.test(direccion) ? direccion : `${direccion}, Córdoba, Argentina`;
}

export async function geocodificar(
  direccion: string,
  cerca?: { lat: number; lng: number },
): Promise<ResultadoGeocoding> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return { ok: false, motivo: "no_disponible" };
  const consulta = conCiudad(direccion.trim());
  const key = clave(consulta);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const params = new URLSearchParams({
    address: consulta,
    components: "country:AR",
    region: "ar",
    language: "es",
    key: apiKey,
  });
  // Prioriza resultados cerca del local (~15 km a la redonda).
  if (cerca)
    params.set(
      "bounds",
      `${cerca.lat - 0.14},${cerca.lng - 0.16}|${cerca.lat + 0.14},${cerca.lng + 0.16}`,
    );

  let value: ResultadoGeocoding;
  try {
    const response = await fetch(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const data = (await response.json()) as { status: string; results?: GoogleResult[] };
    if (data.status === "ZERO_RESULTS") value = { ok: false, motivo: "no_encontrada" };
    else if (data.status !== "OK" || !data.results?.length) {
      // REQUEST_DENIED / OVER_QUERY_LIMIT / etc.: no se cachea, puede ser transitorio.
      console.error("[envios] Geocoding respondió", data.status);
      return { ok: false, motivo: "no_disponible" };
    } else {
      const r = data.results[0]!;
      const precisa =
        r.geometry.location_type === "ROOFTOP" ||
        r.geometry.location_type === "RANGE_INTERPOLATED" ||
        r.types.some((t) => TIPOS_PRECISOS.has(t));
      value = precisa
        ? {
            ok: true,
            punto: {
              lat: r.geometry.location.lat,
              lng: r.geometry.location.lng,
              direccion: r.formatted_address,
            },
          }
        : { ok: false, motivo: "no_encontrada" };
    }
  } catch (error) {
    console.error("[envios] Error de geocodificación", error);
    return { ok: false, motivo: "no_disponible" };
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}
