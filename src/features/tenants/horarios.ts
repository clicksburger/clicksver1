import type { HorarioDia } from "@/types/domain";

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Horario por defecto para empezar a editar (todos los días 11:00–23:00). */
export function horariosDefault(): HorarioDia[] {
  return Array.from({ length: 7 }, (_, dia) => ({
    dia,
    abierto: true,
    abre: "11:00",
    cierra: "23:00",
  }));
}

/** Modelo (array) -> JSON para guardar ({"0":{...}, ...} keyed por día). */
export function horariosToJson(
  h: HorarioDia[],
): Record<string, { abierto: boolean; abre: string; cierra: string }> {
  const o: Record<string, { abierto: boolean; abre: string; cierra: string }> = {};
  for (const d of h) o[String(d.dia)] = { abierto: d.abierto, abre: d.abre, cierra: d.cierra };
  return o;
}

/** JSON guardado -> array de 7 días (rellena faltantes como cerrados). */
export function horariosFromJson(json: unknown): HorarioDia[] {
  const o =
    json && typeof json === "object" ? (json as Record<string, Record<string, unknown>>) : {};
  return Array.from({ length: 7 }, (_, dia) => {
    const e = o[String(dia)] ?? {};
    return {
      dia,
      abierto: Boolean(e.abierto),
      abre: typeof e.abre === "string" ? e.abre : "11:00",
      cierra: typeof e.cierra === "string" ? e.cierra : "23:00",
    };
  });
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * ¿Está abierto el local ahora? null/[] => siempre abierto. Maneja cruce de
 * medianoche (incluye la "cola" nocturna del día anterior). Hora de Buenos Aires.
 */
export function estaAbierto(horarios: HorarioDia[] | null, now: Date = new Date()): boolean {
  if (!horarios || horarios.length === 0) return true;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => Number(parts.find((value) => value.type === name)?.value);
  const dow = new Date(Date.UTC(part("year"), part("month") - 1, part("day"))).getUTCDay();
  const min = part("hour") * 60 + part("minute");

  const hoy = horarios.find((h) => h.dia === dow);
  if (hoy?.abierto) {
    const a = toMin(hoy.abre);
    const c = toMin(hoy.cierra);
    if (a <= c ? min >= a && min < c : min >= a) return true;
  }

  const ayer = horarios.find((h) => h.dia === (dow + 6) % 7);
  if (ayer?.abierto) {
    const a = toMin(ayer.abre);
    const c = toMin(ayer.cierra);
    if (a > c && min < c) return true;
  }
  return false;
}
