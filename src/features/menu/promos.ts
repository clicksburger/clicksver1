import type { MenuItem } from "@/types/domain";

/**
 * Las promos vencen por "día comercial" de Buenos Aires: el día empieza a las
 * 06:00, así un pedido de la madrugada del 2/11 todavía cuenta como 1/11 si el
 * local cierra después de medianoche.
 */
const CORTE_DIA_COMERCIAL_HORAS = 6;

/** Fecha comercial actual (YYYY-MM-DD) en Buenos Aires. */
export function diaComercial(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - CORTE_DIA_COMERCIAL_HORAS * 3600000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/** El producto se puede ofrecer hoy (sin vencimiento o todavía no vencido). */
export function estaVigente(item: Pick<MenuItem, "vigenteHasta">, now: Date = new Date()) {
  return !item.vigenteHasta || item.vigenteHasta >= diaComercial(now);
}

/** Días comerciales que quedan, contando hoy (1 = último día). null si no vence. */
export function diasRestantes(vigenteHasta: string | null, now: Date = new Date()) {
  if (!vigenteHasta) return null;
  const toUtc = (iso: string) =>
    Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((toUtc(vigenteHasta) - toUtc(diaComercial(now))) / 86400000) + 1;
}

/** "1 de noviembre" a partir de YYYY-MM-DD. */
export function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** Texto corto de vigencia para chips y avisos. */
export function textoVigencia(vigenteHasta: string | null, now: Date = new Date()) {
  const dias = diasRestantes(vigenteHasta, now);
  if (dias == null || !vigenteHasta) return "Sin vencimiento";
  if (dias < 1) return `Vencida el ${fechaLarga(vigenteHasta)}`;
  if (dias === 1) return "Último día";
  return `Hasta el ${fechaLarga(vigenteHasta)}`;
}

/**
 * Piezas extra (flyers) de cada promo, por imagen principal del producto. Si
 * el admin cambia la foto desde Configuración, la promo muestra solo la nueva.
 */
const GALERIA: Record<string, string[]> = {
  "/img/promo-cryspy-doble.jpg": ["/img/promo-cryspy-doble-2.jpg"],
};

/**
 * Fotos extra de un producto, por imagen principal. A diferencia de las piezas
 * de GALERIA (una diapositiva cada una), estas rotan dentro de la misma foto:
 * en la tarjeta de la carta, en el detalle y en su pieza del carrusel.
 * Igual que GALERIA: si el admin cambia la foto principal, se muestra solo la nueva.
 */
const FOTOS: Record<string, string[]> = {
  "/img/american-clicks-1.jpg": [
    "/img/american-clicks-2.jpg",
    "/img/american-clicks-3.jpg",
    "/img/american-clicks-4.jpg",
  ],
  "/img/crispy-clicks-1.jpg": ["/img/crispy-clicks-2.jpg", "/img/crispy-clicks.png"],
  "/img/supreme-bacon-1.jpg": ["/img/supreme-bacon-2.jpg"],
};

/** Encuadre de cada foto cuando se recorta (dónde está la burger en la toma). */
const ENCUADRE: Record<string, string> = {
  "/img/american-clicks-1.jpg": "50% 52%",
  "/img/american-clicks-2.jpg": "50% 50%",
  "/img/american-clicks-3.jpg": "50% 50%",
  "/img/american-clicks-4.jpg": "50% 52%",
  "/img/crispy-clicks-1.jpg": "40% 30%",
  "/img/crispy-clicks-2.jpg": "35% 36%",
  "/img/supreme-bacon-1.jpg": "46% 50%",
  "/img/supreme-bacon-2.jpg": "40% 58%",
};

/** Todas las fotos de un producto: la principal y las que rotan con ella. */
export function fotosDe(imagenUrl: string | null): string[] {
  if (!imagenUrl) return [];
  return [imagenUrl, ...(FOTOS[imagenUrl] ?? [])];
}

/** `object-position` de una foto (centro si no tiene uno definido). */
export const encuadreDe = (src: string) => ENCUADRE[src];

/**
 * La carta muestra la categoría "Promociones" dentro de Hamburguesas, primera,
 * para que las promos no queden en una pestaña aparte y se vean con las burgers.
 */
export function unirPromosConHamburguesas<T extends { categoria: string; items: MenuItem[] }>(
  groups: T[],
): T[] {
  const promos = groups.find((group) => /^promo/i.test(group.categoria.trim()));
  const burgers = groups.find((group) => group.categoria.toLowerCase().includes("hamburgues"));
  if (!promos || !burgers) return groups;
  return groups
    .filter((group) => group !== promos)
    .map((group) =>
      group === burgers ? { ...group, items: [...promos.items, ...group.items] } : group,
    );
}

export interface PromoSlide {
  key: string;
  item: MenuItem;
  src: string | null;
  /** Fotos que rotan en esta pieza (la primera es `src`). Una sola: no rota. */
  fotos: string[];
}

/** Diapositivas del carrusel: productos destacados, una por cada pieza gráfica. */
export function promoSlides(
  items: MenuItem[],
  { incluirVencidas = false, now = new Date() } = {},
): PromoSlide[] {
  return items
    .filter((item) => item.activo && item.destacado && (incluirVencidas || estaVigente(item, now)))
    .flatMap((item) => {
      const piezas = item.imagenUrl ? [item.imagenUrl, ...(GALERIA[item.imagenUrl] ?? [])] : [null];
      return piezas.map((src, index) => ({
        key: `${item.id}:${index}`,
        item,
        src,
        fotos: index === 0 ? fotosDe(src) : src ? [src] : [],
      }));
    });
}
