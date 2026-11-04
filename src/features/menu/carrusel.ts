import type { MenuItem } from "@/types/domain";
import { diaComercial, estaVigente, promoSlides, type PromoSlide } from "./promos";

/**
 * Carrusel de la carta, gestionado por el local:
 * - "promo": carrusel de la promo del día (ej. 2x de martes a jueves).
 * - "normal": carrusel de siempre.
 * - "auto": promo los días elegidos, normal el resto.
 * Los productos de la lista "promo" solo se pueden pedir mientras la promo
 * del día está activa; fuera de esos días ni se ven en la carta.
 */
export type ModoCarrusel = "auto" | "promo" | "normal";

export interface CarruselConfig {
  modo: ModoCarrusel;
  /** Días con promo en modo automático (0 domingo … 6 sábado). */
  diasPromo: number[];
  /** Ids de productos del carrusel de promo (solo se venden con la promo activa). */
  promo: string[];
  /** Ids de productos del carrusel normal. */
  normal: string[];
}

export const CARRUSEL_DEFAULT: CarruselConfig = {
  modo: "auto",
  diasPromo: [2, 3, 4],
  promo: [],
  normal: [],
};

export const MODOS_CARRUSEL: { value: ModoCarrusel; label: string; detalle: string }[] = [
  { value: "auto", label: "Automático", detalle: "Promo los días elegidos, normal el resto" },
  { value: "promo", label: "Promo hoy", detalle: "Muestra y vende la promo del día" },
  { value: "normal", label: "Normal", detalle: "Sin promo del día" },
];

export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const ids = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 30) : [];

export function carruselConfigFromJson(json: unknown): CarruselConfig {
  if (!json || typeof json !== "object") return { ...CARRUSEL_DEFAULT };
  const raw = json as Record<string, unknown>;
  const modo = raw.modo === "promo" || raw.modo === "normal" ? raw.modo : "auto";
  const dias = Array.isArray(raw.diasPromo)
    ? [
        ...new Set(
          raw.diasPromo.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6),
        ),
      ]
    : CARRUSEL_DEFAULT.diasPromo;
  return { modo, diasPromo: dias.sort(), promo: ids(raw.promo), normal: ids(raw.normal) };
}

export const carruselConfigToJson = (config: CarruselConfig) => ({
  modo: config.modo,
  diasPromo: config.diasPromo,
  promo: config.promo,
  normal: config.normal,
});

/** Día de la semana comercial en Buenos Aires (el día empieza a las 06:00). */
export function diaSemana(now: Date = new Date()) {
  const fecha = diaComercial(now);
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

export function promoDelDiaActiva(config: CarruselConfig, now: Date = new Date()) {
  return (
    config.modo === "promo" || (config.modo === "auto" && config.diasPromo.includes(diaSemana(now)))
  );
}

/** "Martes, miércoles y jueves" a partir de [2, 3, 4]. */
export function textoDias(dias: number[]) {
  const nombres = [...dias].sort().map((d) => DIAS_LARGOS[d]!);
  if (!nombres.length) return "";
  const texto =
    nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Lo que se puede pedir hoy: promos vigentes y, la promo del día, solo si está activa. */
export function disponibleHoy(item: MenuItem, config: CarruselConfig, now: Date = new Date()) {
  if (!item.activo || !estaVigente(item, now)) return false;
  return !config.promo.includes(item.id) || promoDelDiaActiva(config, now);
}

export interface SlideCarrusel extends PromoSlide {
  /** false: se muestra apagado, con cruz, y no se puede agregar. */
  disponible: boolean;
  /** Texto de la promo (ej. "Martes, miércoles y jueves"). */
  etiqueta?: string;
  /** Versión corta para la pieza (ej. "Mar · Mié · Jue"). */
  etiquetaCorta?: string;
}

/**
 * Diapositivas del carrusel de hoy. `todos` son los productos activos sin
 * filtrar por vigencia, para poder mostrar los vencidos como "No disponible".
 * Si el local todavía no armó ninguna lista, usa los destacados vigentes.
 */
export function slidesCarrusel(
  todos: MenuItem[],
  config: CarruselConfig,
  now: Date = new Date(),
): SlideCarrusel[] {
  const activa = promoDelDiaActiva(config, now);
  const lista = activa && config.promo.length ? config.promo : config.normal;
  if (!lista.length)
    return promoSlides(todos, { now }).map((slide) => ({ ...slide, disponible: true }));
  const etiqueta =
    activa && lista === config.promo
      ? config.modo === "promo"
        ? "Solo por hoy"
        : textoDias(config.diasPromo)
      : undefined;
  const etiquetaCorta =
    etiqueta && config.modo === "auto"
      ? [...config.diasPromo]
          .sort()
          .map((d) => DIAS_CORTOS[d])
          .join(" · ")
      : etiqueta;
  const porId = new Map(todos.map((item) => [item.id, item]));
  return lista.flatMap((id) => {
    const item = porId.get(id);
    if (!item) return [];
    const disponible = disponibleHoy(item, config, now);
    return promoSlides([{ ...item, destacado: true }], { incluirVencidas: true, now }).map(
      (slide) => ({ ...slide, item, disponible, etiqueta, etiquetaCorta }),
    );
  });
}
