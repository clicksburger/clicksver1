"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Ban, Check, ChevronRight, Plus } from "lucide-react";
import { formatPrecio } from "@/lib/format";
import { diasRestantes, textoVigencia } from "../promos";
import type { SlideCarrusel } from "../carrusel";
import { PosterPromo } from "./PosterPromo";
import type { MenuItem } from "@/types/domain";
import "./promo-carousel.css";

const INTERVALO_MS = 6000;

function precioDe(item: MenuItem) {
  if (!item.variantes.length) return formatPrecio(item.precio);
  return `desde ${formatPrecio(Math.min(...item.variantes.map((v) => v.precio)))}`;
}

/** Precio para mostrar grande: el "desde" va chico para no partir la línea. */
function PrecioGrande({ item }: { item: MenuItem }) {
  if (!item.variantes.length) return <>{formatPrecio(item.precio)}</>;
  return (
    <>
      <small>desde</small> {formatPrecio(Math.min(...item.variantes.map((v) => v.precio)))}
    </>
  );
}

/** Distancia circular de una pieza a la activa: 0 al frente, ±1 detrás, etc. */
function offsetOf(i: number, active: number, total: number) {
  let offset = (i - active + total) % total;
  if (offset > total / 2) offset -= total;
  return offset;
}

/** Posición 3D de cada pieza del mazo según su distancia a la activa. */
function cardStyle(offset: number): React.CSSProperties {
  const side = Math.sign(offset);
  const depth = Math.min(Math.abs(offset), 2);
  return {
    "--x": `${side * (depth === 1 ? 16 : 30)}%`,
    "--y": `${depth * -3}%`,
    "--z": `${depth * -150}px`,
    "--ry": `${side * -18 * depth}deg`,
    "--rz": `${side * 4 * depth}deg`,
    "--s": `${1 - depth * 0.1}`,
    zIndex: 10 - depth,
  } as React.CSSProperties;
}

/**
 * Carrusel de promos destacadas de la carta, con las piezas como un mazo en 3D.
 * - Avanza solo: la barra de progreso de la pieza activa es una animación CSS
 *   y su `animationend` pasa a la siguiente. El mouse encima, el dedo apoyado,
 *   el foco de teclado o la pestaña oculta pausan el avance.
 * - Las piezas cambian de lugar con transiciones 3D; la del frente flota sobre
 *   una base de luz y se inclina siguiendo el mouse.
 * - Swipe táctil, teclado (← →) y barras de progreso clickeables; sin botones.
 * - Se anima siempre, aunque el sistema tenga los efectos de animación
 *   apagados (pedido del local: Windows suele traerlos desactivados).
 */
export function PromoCarousel({
  slides,
  onAdd,
  onShow,
}: {
  slides: SlideCarrusel[];
  /** Agrega al pedido un producto sin opciones. */
  onAdd: (item: MenuItem) => void;
  /** Lleva al producto cuando hay que elegir opciones (simple, doble, triple…). */
  onShow: (item: MenuItem) => void;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  const total = slides.length;
  const active = Math.min(index, Math.max(0, total - 1));
  const multiple = total > 1;
  const autoplay = multiple;
  const paused = hovered || touching || focused || hidden;

  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(addedTimer.current);
    };
  }, []);

  const go = useCallback(
    (step: 1 | -1) => {
      if (multiple) setIndex((current) => (Math.min(current, total - 1) + step + total) % total);
    },
    [multiple, total],
  );

  if (!total) return null;

  function add(item: MenuItem) {
    if (item.variantes.length) {
      onShow(item);
      return;
    }
    onAdd(item);
    setAdded(item.id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 1400);
  }

  /** Inclinación 3D de la pieza del frente siguiendo el mouse (no en táctil). */
  function tilt(event: React.PointerEvent<HTMLDivElement>) {
    const deck = deckRef.current;
    if (!deck || event.pointerType !== "mouse") return;
    const rect = deck.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    deck.style.setProperty("--tilt-y", `${(px - 0.5) * 22}deg`);
    deck.style.setProperty("--tilt-x", `${(0.5 - py) * 18}deg`);
    deck.style.setProperty("--glare-x", `${px * 100}%`);
    deck.style.setProperty("--glare-y", `${py * 100}%`);
    deck.dataset.tilting = "true";
  }
  function untilt() {
    const deck = deckRef.current;
    if (!deck) return;
    deck.style.setProperty("--tilt-y", "0deg");
    deck.style.setProperty("--tilt-x", "0deg");
    delete deck.dataset.tilting;
  }

  const actual = slides[active]!;
  const item = actual.item;
  const disponible = actual.disponible;
  const dias = diasRestantes(item.vigenteHasta);
  const justAdded = added === item.id;
  // La cinta solo anuncia lo que se puede pedir hoy.
  const uniqueItems = slides.filter(
    (slide, i) => slide.disponible && slides.findIndex((s) => s.item.id === slide.item.id) === i,
  );

  return (
    <section
      className={`pc ${paused || !autoplay ? "is-paused" : ""}`}
      aria-roledescription="carrusel"
      aria-label="Promos de Clicks"
      // El mouse encima pausa; el toque del dedo no deja la pausa "pegada".
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
      // Solo el foco de teclado pausa: un clic en las flechas no debe frenarlo para siempre.
      onFocus={(event) => setFocused(event.target.matches(":focus-visible"))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        else if (event.key === "ArrowLeft") go(-1);
      }}
      style={{ "--pc-interval": `${INTERVALO_MS}ms` } as React.CSSProperties}
    >
      <div className="pc-marquee" aria-hidden="true">
        <div className="pc-marquee-track">
          {Array.from({ length: 2 }, (_, copy) => (
            <span key={copy}>
              {uniqueItems.map((slide) => (
                <span key={slide.item.id}>
                  <b>Promo</b> {slide.item.nombre} <i>{precioDe(slide.item)}</i>
                  <em>✦</em>
                </span>
              ))}
              <span>
                <b>Clicks</b> Tu antojo, a un click <em>✦</em>
              </span>
            </span>
          ))}
        </div>
      </div>

      <div
        className="pc-stage"
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
          if (event.pointerType !== "mouse") setTouching(true);
        }}
        onPointerUp={(event) => {
          setTouching(false);
          const start = pointer.current;
          pointer.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(event.clientY - start.y))
            go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setTouching(false);
        }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            className="pc-backdrop"
            data-active={i === active}
            aria-hidden="true"
          >
            {slide.src && (
              <Image src={slide.src} alt="" fill sizes="30vw" className="pc-backdrop-img" />
            )}
          </div>
        ))}

        <div className="pc-showcase">
          <div className="pc-floor" aria-hidden="true">
            <span className="pc-ring" />
            <span className="pc-shadow" />
          </div>
          <div ref={deckRef} className="pc-deck" onPointerMove={tilt} onPointerLeave={untilt}>
            {slides.map((slide, i) => {
              const offset = offsetOf(i, active, total);
              const pos = offset === 0 ? "front" : Math.abs(offset) === 1 ? "back" : "far";
              return (
                <figure
                  key={slide.key}
                  className="pc-card"
                  data-pos={pos}
                  style={cardStyle(offset)}
                  aria-hidden={pos !== "front"}
                  onClick={pos === "back" ? () => go(offset > 0 ? 1 : -1) : undefined}
                >
                  <div className="pc-card-float">
                    <div className="pc-card-tilt">
                      <div
                        className={`pc-card-face ${slide.src ? "sk-img" : ""} ${slide.disponible ? "" : "is-off"}`}
                      >
                        {slide.src ? (
                          <Image
                            src={slide.src}
                            alt={pos === "front" ? `Pieza de la promo ${slide.item.nombre}` : ""}
                            fill
                            sizes="(max-width: 700px) 42vw, 320px"
                            priority={i === 0}
                            className="pc-card-img"
                            draggable={false}
                            onLoad={(event) => {
                              event.currentTarget.dataset.loaded = "1";
                            }}
                          />
                        ) : (
                          <PosterPromo item={slide.item} etiqueta={slide.etiquetaCorta} />
                        )}
                        {!slide.disponible && (
                          <span className="pc-off" aria-hidden="true">
                            <b>
                              <Ban size={16} /> No disponible
                            </b>
                          </span>
                        )}
                        <span className="pc-glare" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </figure>
              );
            })}
          </div>
        </div>

        {/* La clave remonta el texto al cambiar de producto: vuelve a correr la entrada. */}
        <div
          key={item.id}
          className="pc-copy"
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${active + 1} de ${total}: ${item.nombre}`}
        >
          <span className={`pc-chip ${!disponible ? "is-expired" : dias === 1 ? "is-last" : ""}`}>
            <i aria-hidden="true" />
            {!disponible ? (
              "No disponible por ahora"
            ) : item.vigenteHasta ? (
              <>
                <span className="pc-chip-label">Promo · </span>
                {textoVigencia(item.vigenteHasta)}
              </>
            ) : (
              <>
                <span className="pc-chip-largo">{actual.etiqueta ?? "Destacada de Clicks"}</span>
                <span className="pc-chip-corto">
                  {actual.etiquetaCorta ?? actual.etiqueta ?? "Destacada"}
                </span>
              </>
            )}
          </span>
          <h3>{item.nombre}</h3>
          {item.descripcion && <p>{item.descripcion}</p>}
          <strong className={`pc-price ${disponible ? "" : "is-off"}`}>
            <PrecioGrande item={item} />
          </strong>
          <div className="pc-actions">
            <button
              type="button"
              className={`pc-cta ${justAdded ? "is-added" : ""} ${disponible ? "" : "is-off"}`}
              onClick={() => add(item)}
              disabled={!disponible}
            >
              {!disponible ? (
                <>
                  <Ban size={18} /> No disponible
                </>
              ) : justAdded ? (
                <>
                  <Check size={18} /> ¡Agregada!
                </>
              ) : item.variantes.length ? (
                <>
                  Elegir opción <ChevronRight size={18} />
                </>
              ) : (
                <>
                  <Plus size={18} /> Agregar al pedido
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {multiple && (
        <div className="pc-controls">
          <div className="pc-dots" role="group" aria-label="Elegir promo">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                aria-label={`Ver promo ${i + 1} de ${total}`}
                aria-current={i === active}
                onClick={() => setIndex(i)}
              >
                <span
                  // La clave reinicia la barra cada vez que la pieza vuelve al frente.
                  key={i === active ? `on-${active}` : "off"}
                  className={
                    i === active
                      ? autoplay
                        ? "is-running"
                        : "is-full"
                      : i < active
                        ? "is-full"
                        : ""
                  }
                  onAnimationEnd={i === active ? () => go(1) : undefined}
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Mientras avanza solo no se anuncia cada cambio (sería ruido para el lector). */}
      <p className="sr-only" aria-live={autoplay && !paused ? "off" : "polite"}>
        {item.nombre}, {precioDe(item)}.
      </p>
    </section>
  );
}
