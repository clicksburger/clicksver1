"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { encuadreDe } from "../promos";

/**
 * Varias fotos de un producto apiladas en el mismo lugar: cada tanto pasa a la
 * siguiente con un fundido, y la que está a la vista se acerca y se corre un
 * poco (zoom lento). Va dentro de un contenedor con `position: relative`.
 * - Se detiene fuera de pantalla y con la pestaña oculta.
 * - `activo={false}` la deja quieta en la foto actual (ej. pieza de atrás del carrusel).
 * - `desfase` corre el primer cambio para que varias tarjetas no cambien juntas.
 */
export function FotosRotativas({
  fotos,
  alt,
  sizes,
  className,
  intervalo = 3600,
  desfase = 0,
  activo = true,
  zoom = true,
  priority = false,
  unoptimized = false,
  onLoad,
}: {
  fotos: string[];
  alt: string;
  sizes: string;
  className?: string;
  intervalo?: number;
  desfase?: number;
  activo?: boolean;
  zoom?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [actual, setActual] = useState(0);
  const [visible, setVisible] = useState(true);
  const primera = useRef<HTMLImageElement>(null);
  const total = fotos.length;

  useEffect(() => {
    const img = primera.current;
    if (!img || total < 2 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      rootMargin: "80px",
    });
    observer.observe(img);
    return () => observer.disconnect();
  }, [total]);

  useEffect(() => {
    if (!activo || !visible || total < 2) return;
    let timer: ReturnType<typeof setTimeout>;
    let primeraVez = true;
    const programar = () => {
      timer = setTimeout(
        () => {
          primeraVez = false;
          if (!document.hidden) setActual((value) => (value + 1) % total);
          programar();
        },
        primeraVez ? intervalo + desfase : intervalo,
      );
    };
    programar();
    return () => clearTimeout(timer);
  }, [activo, visible, total, intervalo, desfase]);

  return (
    <>
      {fotos.map((src, i) => (
        <Image
          key={src}
          ref={i === 0 ? primera : undefined}
          src={src}
          alt={i === actual ? alt : ""}
          aria-hidden={i === actual ? undefined : true}
          fill
          sizes={sizes}
          priority={priority && i === 0}
          unoptimized={unoptimized}
          draggable={false}
          className={cn(className, "foto-rot", zoom && "foto-rot-zoom")}
          style={encuadreDe(src) ? { objectPosition: encuadreDe(src) } : undefined}
          data-on={i === actual}
          onLoad={onLoad}
        />
      ))}
    </>
  );
}
