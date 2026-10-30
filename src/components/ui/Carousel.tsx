"use client";

import { Children, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Carrusel horizontal con scroll-snap nativo (swipe tactil + momentum).
 *
 * - Con `title`: renderiza un header (titulo a la izquierda, accion opcional
 *   y flechas a la derecha) FUERA de las cards. Es el modo recomendado.
 * - Sin `title`: cae al modo legacy con flechas superpuestas (overlay) sobre
 *   los bordes del track, visibles solo en desktop.
 */
export function Carousel({
  children,
  className,
  title,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const roundBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  const track = (
    <div
      ref={trackRef}
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {Children.map(children, (child) => (
        <div className="shrink-0 basis-[64%] snap-start sm:basis-[46%] lg:basis-[31%]">
          {child}
        </div>
      ))}
    </div>
  );

  if (title) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl tracking-wide text-text">{title}</h2>
          <div className="flex items-center gap-2">
            {action}
            <button
              type="button"
              onClick={() => scroll(-1)}
              aria-label="Anterior"
              className={cn(roundBtn, "border border-border bg-surface2 text-text hover:bg-surface3")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              aria-label="Siguiente"
              className={cn(roundBtn, "bg-primary text-bg hover:opacity-90")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        {track}
      </div>
    );
  }

  return (
    <div className={cn("group relative", className)}>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Anterior"
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-surface/90 p-2 text-text shadow-card transition hover:bg-surface2 sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      {track}
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Siguiente"
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-surface/90 p-2 text-text shadow-card transition hover:bg-surface2 sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
