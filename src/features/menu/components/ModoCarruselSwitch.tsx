"use client";

import { useState, useTransition } from "react";
import { GalleryHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  MODOS_CARRUSEL,
  promoDelDiaActiva,
  type CarruselConfig,
  type ModoCarrusel,
} from "../carrusel";
import { cambiarModoCarrusel } from "../carrusel.actions";

/**
 * Selector rápido del carrusel para la caja: los chicos eligen si hoy va la
 * promo o el carrusel normal (o automático por días). Se guarda al tocar.
 */
export function ModoCarruselSwitch({
  tenantId,
  slug,
  inicial,
}: {
  tenantId: string;
  slug: string;
  inicial: CarruselConfig;
}) {
  const [config, setConfig] = useState(inicial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const promoHoy = promoDelDiaActiva(config);

  function elegir(modo: ModoCarrusel) {
    if (modo === config.modo || pending) return;
    const anterior = config;
    setConfig({ ...config, modo });
    setError(null);
    startTransition(async () => {
      try {
        const result = await cambiarModoCarrusel(tenantId, slug, modo);
        if (!result.ok) throw new Error(result.mensaje);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 1800);
      } catch (cause) {
        setConfig(anterior);
        setError(cause instanceof Error ? cause.message : "No se pudo cambiar el carrusel.");
      }
    });
  }

  return (
    <div className="ops-carrusel" aria-busy={pending}>
      <span className="ops-carrusel-label">
        <GalleryHorizontal className="h-4 w-4" aria-hidden="true" /> Carrusel
        <b className={promoHoy ? "is-promo" : undefined}>
          {guardado ? "¡Listo!" : promoHoy ? "Promo hoy" : "Normal"}
        </b>
      </span>
      <div role="radiogroup" aria-label="Carrusel de la carta" className="ops-carrusel-options">
        {MODOS_CARRUSEL.map((modo) => (
          <button
            key={modo.value}
            type="button"
            role="radio"
            aria-checked={config.modo === modo.value}
            title={modo.detalle}
            disabled={pending}
            onClick={() => elegir(modo.value)}
            className={cn(config.modo === modo.value && "is-active")}
          >
            {modo.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="ops-carrusel-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
