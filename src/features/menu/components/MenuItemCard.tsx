"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { Check, Plus, UtensilsCrossed } from "lucide-react";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPrecio } from "@/lib/format";
import { useCartStore } from "../store/cart.store";
import type { MenuItem } from "@/types/domain";

type Layout = "overlay" | "compact";

/** Marca el boton "+" como recien usado durante ~1.2s (feedback visual). */
function useJustAdded() {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1200);
  }, []);
  return [added, flash] as const;
}

/**
 * Solo pasan por el optimizador de Next las rutas propias y Storage de Supabase
 * (los hosts habilitados en next.config). Cualquier otra URL se muestra tal cual.
 */
function optimizable(src: string) {
  return src.startsWith("/") || /\.supabase\.co\/storage\/v1\/object\/public\//.test(src);
}

/**
 * Card de producto del menu publico.
 * - layout "overlay": imagen full-bleed con texto encima (pantallas grandes).
 * - layout "compact": horizontal imagen+texto (celular / listas).
 * El botón abre el detalle para elegir opciones y dejar observaciones.
 * Memoizada: actualizar el carrito no vuelve a renderizar toda la carta.
 */
export const MenuItemCard = memo(function MenuItemCard({
  item,
  layout = "overlay",
}: {
  item: MenuItem;
  layout?: Layout;
}) {
  const add = useCartStore((s) => s.add);
  const [added, flash] = useJustAdded();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [observations, setObservations] = useState("");
  const formId = useId();

  const hasVariants = item.variantes.length > 0;
  const isDip = item.nombre.trim().toUpperCase() === "DIP DE SALSAS";
  const chosen = item.variantes.filter((variant) => selected.includes(variant.id));
  const selectedPrice = isDip
    ? (item.precio ?? item.variantes[0]?.precio ?? 0)
    : (chosen[0]?.precio ?? item.precio ?? 0);
  const desde = hasVariants ? Math.min(...item.variantes.map((v) => v.precio)) : (item.precio ?? 0);
  const precioLabel = hasVariants ? `desde ${formatPrecio(desde)}` : formatPrecio(item.precio);

  const onPlus = () => {
    setSelected([]);
    setObservations("");
    setModalOpen(true);
  };

  const addConfigured = () => {
    if (hasVariants && !chosen.length) return;
    add({
      itemId: item.id,
      nombre: item.nombre,
      variante: chosen.length ? chosen.map((variant) => variant.label).join(" + ") : null,
      precio: selectedPrice,
      obs: observations,
    });
    flash();
    setModalOpen(false);
  };

  const plusBtn = (extra?: string) => (
    <button
      type="button"
      aria-label={hasVariants ? `Elegir opción de ${item.nombre}` : `Agregar ${item.nombre}`}
      onClick={onPlus}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        added ? "bg-success text-white" : "bg-primary text-bg hover:opacity-90",
        extra,
      )}
    >
      {added ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      <span className={layout === "overlay" ? "sr-only" : undefined}>
        {added ? "Agregado" : "Agregar"}
      </span>
    </button>
  );

  // Las fotos originales miden hasta 1800px y pesan hasta 1,4 MB; la tarjeta las
  // muestra a ~110px. Con `sizes` el navegador baja una versión liviana (WebP).
  const img = (className: string, sizes = "(min-width: 1600px) 120px, 110px") =>
    item.imagenUrl ? (
      <Image
        src={item.imagenUrl}
        alt={item.nombre}
        fill
        sizes={sizes}
        unoptimized={!optimizable(item.imagenUrl)}
        className={className}
      />
    ) : (
      <div className={cn("flex items-center justify-center bg-surface2 text-muted", className)}>
        <div className="flex flex-col items-center gap-2">
          <UtensilsCrossed className="h-7 w-7" aria-hidden="true" />
          <span className="text-[10px]">Sin foto</span>
        </div>
      </div>
    );

  const variantModal = (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={item.nombre}
      className="cm-product-dialog max-w-lg"
      backdropClassName="cm-modal-backdrop"
    >
      <div className="cm-product-detail">
        {item.imagenUrl && (
          <div className="cm-detail-photo">
            <Image
              src={item.imagenUrl}
              alt={item.nombre}
              fill
              sizes="(max-width: 700px) 100vw, 512px"
              unoptimized={!optimizable(item.imagenUrl)}
            />
          </div>
        )}
        {item.descripcion && (
          <p className="mb-4 text-sm leading-relaxed text-muted">{item.descripcion}</p>
        )}
        <p className="mb-4 text-sm font-bold">Personalizá tu selección</p>
        <p className="mb-4 text-xs text-muted">
          Las opciones y observaciones aplican a cada unidad agregada.
        </p>
        {hasVariants && (
          <fieldset className="cm-detail-options mb-5 flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">{isDip ? "Salsas" : "Presentación"}</legend>
            <p className="mb-1 text-xs text-muted">
              {isDip
                ? "Seleccioná las salsas que quieras para tu dip. El precio corresponde a una porción."
                : "Seleccioná una opción."}
            </p>
            {item.variantes.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface2 px-4 py-3 text-left transition hover:border-primary"
              >
                <input
                  type={isDip ? "checkbox" : "radio"}
                  name={`${formId}-options`}
                  checked={selected.includes(v.id)}
                  onChange={() =>
                    setSelected((current) =>
                      isDip
                        ? current.includes(v.id)
                          ? current.filter((id) => id !== v.id)
                          : [...current, v.id]
                        : [v.id],
                    )
                  }
                  className="h-4 w-4 accent-[#ffd21c]"
                />
                <span className="font-bold text-text">{v.label}</span>
                {!isDip && (
                  <span className="ml-auto font-display text-lg text-primary">
                    {formatPrecio(v.precio)}
                  </span>
                )}
              </label>
            ))}
          </fieldset>
        )}
        <div className="mb-2 flex items-center justify-between text-xs">
          <label htmlFor={`${formId}-obs`} className="font-bold">
            Observaciones
          </label>
          <span id={`${formId}-count`} className="text-muted">
            {observations.length} / 150
          </span>
        </div>
        <textarea
          id={`${formId}-obs`}
          maxLength={150}
          rows={3}
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          aria-describedby={`${formId}-count`}
          placeholder="Por ejemplo: sin sal. Máximo 150 caracteres."
          className="mb-4 w-full resize-y rounded-xl border border-border bg-surface2 p-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          disabled={hasVariants && !chosen.length}
          onClick={addConfigured}
          className="cm-detail-submit flex w-full items-center justify-between rounded-xl bg-primary px-4 py-3 font-bold text-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Agregar al pedido</span>
          <span key={selectedPrice} className="cm-config-price">
            {hasVariants && !chosen.length && !isDip
              ? "Elegí una opción"
              : formatPrecio(selectedPrice)}
          </span>
        </button>
      </div>
    </Modal>
  );

  if (layout === "compact") {
    return (
      <>
        <article className={`cm-product-card ${added ? "cm-just-added" : ""}`}>
          <button
            type="button"
            className="cm-card-image"
            onClick={onPlus}
            aria-label={`Ver foto y detalle de ${item.nombre}`}
          >
            {img("cm-card-photo")}
          </button>
          <div className="cm-card-body">
            <div className="cm-card-heading">
              <h3>
                <button type="button" onClick={onPlus}>
                  {item.nombre}
                </button>
              </h3>
              <span className="cm-card-price">{precioLabel}</span>
            </div>
            {item.descripcion && <p className="cm-card-description">{item.descripcion}</p>}
            <div className="cm-card-bottom">
              {item.destacado && <span className="cm-card-featured">Destacada de Clicks</span>}
              {plusBtn("cm-card-add")}
            </div>
          </div>
        </article>
        {variantModal}
      </>
    );
  }

  // layout "overlay"
  return (
    <>
      <article className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-surface2 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-card-hover">
        {img(
          "absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]",
          "(max-width: 700px) 100vw, 360px",
        )}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(to top, rgba(0,0,0,0.92) 24%, rgba(0,0,0,0) 64%)",
          }}
          aria-hidden="true"
        />
        <span className="absolute left-3 top-3 rounded-full border border-border bg-bg px-3 py-1 text-sm font-bold text-primary">
          {precioLabel}
        </span>
        {plusBtn("absolute right-3 top-3 h-10 w-10")}
        <div className="relative p-4">
          <h3 className="font-display text-xl leading-tight tracking-wide text-white">
            {item.nombre}
          </h3>
          {item.descripcion && (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/80">
              {item.descripcion}
            </p>
          )}
        </div>
      </article>
      {variantModal}
    </>
  );
});
