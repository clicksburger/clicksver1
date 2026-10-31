"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { formatPrecio } from "@/lib/format";
import { diasRestantes, textoVigencia, type PromoSlide } from "../promos";
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
 * Carrusel de promos destacadas, con las piezas como un mazo en 3D.
 * - Avanza solo: la barra de progreso de la pieza activa es una animación CSS
 *   y su `animationend` pasa a la siguiente. Pausar la animación (mouse encima,
 *   dedo apoyado, foco de teclado, pestaña oculta o botón de pausa) pausa el avance.
 * - Las piezas cambian de lugar con transiciones 3D; la del frente flota sobre
 *   una base de luz y se inclina siguiendo el mouse.
 * - Swipe táctil, flechas, teclado (← →) y barras de progreso clickeables.
 * - Con "reducir movimiento" no avanza solo ni anima.
 * - variant "menu": botón para agregar al pedido. "admin": vigencia y accesos.
 */
export function PromoCarousel({
  slides,
  variant,
  onAdd,
  onShow,
  editHref,
  menuHref,
}: {
  slides: PromoSlide[];
  variant: "menu" | "admin";
  /** Agrega al pedido un producto sin opciones. */
  onAdd?: (item: MenuItem) => void;
  /** Lleva al producto cuando hay que elegir opciones (simple, doble, triple…). */
  onShow?: (item: MenuItem) => void;
  editHref?: string;
  menuHref?: string;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  const total = slides.length;
  const active = Math.min(index, Math.max(0, total - 1));
  const multiple = total > 1;
  const autoplay = multiple && !reduced && !stopped;
  const paused = hovered || touching || focused || hidden;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", sync);
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

  if (!total) {
    return variant === "admin" ? (
      <div className="pc-empty">
        <Sparkles size={22} />
        <div>
          <strong>No hay promos destacadas.</strong>
          <span>
            Marcá un producto como destacado en Configuración para mostrarlo acá y en la carta.
          </span>
        </div>
        {editHref && (
          <Link href={editHref}>
            Ir al menú <ArrowUpRight size={15} />
          </Link>
        )}
      </div>
    ) : null;
  }

  function add(item: MenuItem) {
    if (item.variantes.length) {
      onShow?.(item);
      return;
    }
    onAdd?.(item);
    setAdded(item.id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 1400);
  }

  /** Inclinación 3D de la pieza del frente siguiendo el mouse (no en táctil). */
  function tilt(event: React.PointerEvent<HTMLDivElement>) {
    const deck = deckRef.current;
    if (!deck || event.pointerType !== "mouse" || reduced) return;
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

  const item = slides[active]!.item;
  const dias = diasRestantes(item.vigenteHasta);
  const vencida = dias != null && dias < 1;
  const justAdded = added === item.id;
  const uniqueItems = slides.filter(
    (slide, i) => slides.findIndex((s) => s.item.id === slide.item.id) === i,
  );

  return (
    <section
      className={`pc pc--${variant} ${paused || !autoplay ? "is-paused" : ""}`}
      aria-roledescription="carrusel"
      aria-label={variant === "menu" ? "Promos de Clicks" : "Promos activas"}
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
      {variant === "menu" && (
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
      )}

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
                      <div className="pc-card-face">
                        {slide.src ? (
                          <Image
                            src={slide.src}
                            alt={pos === "front" ? `Pieza de la promo ${slide.item.nombre}` : ""}
                            fill
                            sizes={variant === "menu" ? "(max-width: 700px) 42vw, 320px" : "160px"}
                            priority={variant === "menu" && i === 0}
                            className="pc-card-img"
                            draggable={false}
                          />
                        ) : (
                          <span className="pc-card-empty">
                            <Sparkles size={32} />
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
          <span className={`pc-chip ${vencida ? "is-expired" : dias === 1 ? "is-last" : ""}`}>
            <i aria-hidden="true" />
            {variant === "admin" && vencida ? (
              `${textoVigencia(item.vigenteHasta)} · ya no se muestra`
            ) : (
              <>
                <span className="pc-chip-label">Promo · </span>
                {textoVigencia(item.vigenteHasta)}
              </>
            )}
          </span>
          <h3>{item.nombre}</h3>
          {item.descripcion && <p>{item.descripcion}</p>}
          <strong className="pc-price">
            <PrecioGrande item={item} />
          </strong>
          {variant === "menu" ? (
            <div className="pc-actions">
              <button
                type="button"
                className={`pc-cta ${justAdded ? "is-added" : ""}`}
                onClick={() => add(item)}
              >
                {justAdded ? (
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
          ) : (
            <div className="pc-actions">
              {editHref && (
                <Link className="pc-cta" href={editHref}>
                  Editar promo <ArrowUpRight size={16} />
                </Link>
              )}
              {menuHref && (
                <Link className="pc-link" href={menuHref} target="_blank" rel="noopener noreferrer">
                  Ver en la carta <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          )}
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
          <div className="pc-arrows">
            {!reduced && (
              <button
                type="button"
                onClick={() => setStopped((value) => !value)}
                aria-label={
                  stopped ? "Reanudar el avance automático" : "Pausar el avance automático"
                }
              >
                {stopped ? <Play size={16} /> : <Pause size={16} />}
              </button>
            )}
            <button type="button" onClick={() => go(-1)} aria-label="Promo anterior">
              <ChevronLeft size={19} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Promo siguiente">
              <ChevronRight size={19} />
            </button>
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
