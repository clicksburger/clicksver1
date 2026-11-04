import Image from "next/image";
import { formatPrecio } from "@/lib/format";
import type { MenuItem } from "@/types/domain";
import "./promo-carousel.css";

/**
 * Pieza diseñada para promos sin foto (ej. la 2x): número grande, opciones con
 * precio y la mascota de Clicks. Escala con su contenedor (unidades cq), así
 * sirve igual en el carrusel, en el celular y en la tarjeta de la grilla.
 * Cuando el local sube un flyer al producto, se usa el flyer.
 */
export function PosterPromo({ item, etiqueta }: { item: MenuItem; etiqueta?: string }) {
  const nombre = item.nombre.replace(/^promo\s+/i, "");
  const dos = /^2\b/.test(nombre);
  return (
    <div className="pc-poster">
      <div className="pc-poster-inner">
        {etiqueta && <span className="pc-poster-dias">{etiqueta}</span>}
        {dos ? (
          <>
            <strong className="pc-poster-big">
              2<small>x</small>
            </strong>
            <span className="pc-poster-sub">{nombre.replace(/^2\s+/, "")}</span>
          </>
        ) : (
          <strong className="pc-poster-name">{nombre}</strong>
        )}
        {item.variantes.length ? (
          <ul className="pc-poster-list">
            {item.variantes.map((variante) => (
              <li key={variante.id}>
                <span>{variante.label}</span>
                <b>{formatPrecio(variante.precio)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <b className="pc-poster-price">{formatPrecio(item.precio)}</b>
        )}
        <Image
          src="/img/mascota-burger.png"
          alt=""
          width={420}
          height={387}
          sizes="160px"
          className="pc-poster-mascot"
          draggable={false}
        />
      </div>
    </div>
  );
}
