"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Bottom sheet movil (panel deslizante desde abajo). Reutiliza el mismo
 * patron de accesibilidad que Modal (cierre con Escape, scroll-lock del body,
 * cierre por backdrop) pero anclado al borde inferior, ideal para flujos
 * mobile-first como el carrito. En desktop conviene usar un panel fijo.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex max-h-[88vh] w-full animate-slide-up flex-col rounded-t-2xl border-t border-border bg-surface shadow-sheet",
          "pb-[max(1rem,env(safe-area-inset-bottom))]",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-surface3" aria-hidden="true" />
        </div>

        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          {title ? (
            <h2 className="font-display text-xl tracking-wide text-text">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">{children}</div>
      </div>
    </div>
  );
}
