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

/**
 * Carrusel de promos destacadas.
 * - Avanza solo: la barra de progreso de la diapositiva activa es una animación
 *   CSS y su `animationend` pasa a la siguiente. Pausar la animación (hover,
 *   foco, pestaña oculta, botón de pausa) pausa también el avance.
 * - Swipe táctil, flechas, teclado (← →) y puntos de progreso clickeables.
 * - Con "reducir movimiento" no avanza solo ni anima el ingreso.
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
  const [dir, setDir] = useState<1 | -1>(1);
  /** Diapositiva que está saliendo: se anima hacia afuera en la dirección del avance. */
  const [leaving, setLeaving] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const total = slides.length;
  const active = Math.min(index, Math.max(0, total - 1));
  const multiple = total > 1;
  const autoplay = multiple && !reduced && !stopped;
  const paused = hovered || focused || hidden;

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
      if (!multiple) return;
      setDir(step);
      setLeaving(active);
      setIndex((active + step + total) % total);
    },
    [multiple, total, active],
  );
  const goTo = (target: number) => {
    if (target === active) return;
    setDir(target > active ? 1 : -1);
    setLeaving(active);
    setIndex(target);
  };

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

  const current = slides[active]!;

  return (
    <section
      className={`pc pc--${variant} ${paused || !autoplay ? "is-paused" : ""}`}
      aria-roledescription="carrusel"
      aria-label={variant === "menu" ? "Promos de Clicks" : "Promos activas"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
                {slides
                  .filter((slide, i) => slides.findIndex((s) => s.item.id === slide.item.id) === i)
                  .map((slide) => (
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
        data-dir={dir === 1 ? "next" : "prev"}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(event.clientY - start.y))
            go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (pointer.current = null)}
      >
        <div className="pc-glow" aria-hidden="true" />
        {slides.map((slide, i) => {
          const state = i === active ? "active" : i === leaving ? "leaving" : "idle";
          const dias = diasRestantes(slide.item.vigenteHasta);
          const vencida = dias != null && dias < 1;
          const justAdded = added === slide.item.id;
          return (
            <div
              key={slide.key}
              className="pc-slide"
              data-state={state}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}: ${slide.item.nombre}`}
              aria-hidden={state !== "active"}
              inert={state !== "active"}
            >
              <div className="pc-backdrop" aria-hidden="true">
                {slide.src && (
                  <Image src={slide.src} alt="" fill sizes="40vw" className="pc-backdrop-img" />
                )}
              </div>
              <figure className="pc-flyer">
                <div className="pc-flyer-card">
                  {slide.src ? (
                    <Image
                      src={slide.src}
                      alt={`Pieza de la promo ${slide.item.nombre}`}
                      fill
                      sizes={variant === "menu" ? "(max-width: 700px) 62vw, 330px" : "220px"}
                      priority={variant === "menu" && i === 0}
                      className="pc-flyer-img"
                    />
                  ) : (
                    <span className="pc-flyer-empty">
                      <Sparkles size={32} />
                    </span>
                  )}
                </div>
              </figure>
              <div className="pc-copy">
                <span className={`pc-chip ${vencida ? "is-expired" : dias === 1 ? "is-last" : ""}`}>
                  <i aria-hidden="true" />
                  {variant === "admin" && vencida
                    ? `${textoVigencia(slide.item.vigenteHasta)} · ya no se muestra`
                    : `Promo · ${textoVigencia(slide.item.vigenteHasta)}`}
                </span>
                <h3>{slide.item.nombre}</h3>
                {slide.item.descripcion && <p>{slide.item.descripcion}</p>}
                <strong className="pc-price">{precioDe(slide.item)}</strong>
                {variant === "menu" ? (
                  <div className="pc-actions">
                    <button
                      type="button"
                      className={`pc-cta ${justAdded ? "is-added" : ""}`}
                      onClick={() => add(slide.item)}
                    >
                      {justAdded ? (
                        <>
                          <Check size={19} /> ¡Agregada al pedido!
                        </>
                      ) : slide.item.variantes.length ? (
                        <>
                          Elegir opción <ChevronRight size={19} />
                        </>
                      ) : (
                        <>
                          <Plus size={19} /> Agregar al pedido
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
                      <Link
                        className="pc-link"
                        href={menuHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver en la carta <ArrowUpRight size={15} />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
                onClick={() => goTo(i)}
              >
                <span
                  // La clave reinicia la animación cada vez que la diapositiva vuelve a estar activa.
                  key={i === active ? `on-${active}-${dir}` : "off"}
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
        {current.item.nombre}, {precioDe(current.item)}.
      </p>
    </section>
  );
}
