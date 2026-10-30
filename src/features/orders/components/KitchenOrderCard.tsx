"use client";

import { useEffect, useState } from "react";
import { Clock, Bike, Store, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Pedido, TipoPedido } from "@/types/domain";

const TIPO: Record<TipoPedido, { label: string; Icon: typeof Bike }> = {
  delivery: { label: "Delivery", Icon: Bike },
  salon: { label: "Salón", Icon: Store },
  takeaway: { label: "Take away", Icon: ShoppingBag },
};

type Urgencia = "enTiempo" | "porVencer" | "demorado";

const COLOR: Record<Urgencia, { chip: string; borde: string }> = {
  enTiempo: { chip: "bg-success text-bg", borde: "border-l-success" },
  porVencer: { chip: "bg-primary text-bg", borde: "border-l-primary" },
  demorado: { chip: "bg-danger text-white", borde: "border-l-danger" },
};

function calcularUrgencia(min: number, demora: number | null): Urgencia {
  if (demora == null) {
    if (min >= 20) return "demorado";
    if (min >= 10) return "porVencer";
    return "enTiempo";
  }
  if (min >= demora) return "demorado";
  if (min >= demora * 0.8) return "porVencer";
  return "enTiempo";
}

function fmt(totalSeg: number): string {
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Card de cocina pensado para TV: número grande, ítems grandes y un semáforo
 * de tiempo (verde en tiempo / naranja por vencer / rojo demorado) según la
 * demora pactada. Solo lectura: no dispara acciones.
 */
export function KitchenOrderCard({ pedido }: { pedido: Pedido }) {
  const desde = pedido.horaConfirmado ?? pedido.creadoEn;
  const [seg, setSeg] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(
      () => setSeg(Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [desde]);

  const u = calcularUrgencia(seg / 60, pedido.demora);
  const color = COLOR[u];
  const tipo = TIPO[pedido.tipo];
  const TipoIcon = tipo.Icon;
  const ready = pedido.estado === "listo";
  const urgencyLabel =
    u === "demorado" ? "Demorado" : u === "porVencer" ? "Próximo al tiempo estimado" : "En tiempo";

  return (
    <div
      className={cn(
        "ops-kitchen-card flex flex-col gap-4 rounded-xl border border-l-8 border-border bg-surface p-5",
        color.borde,
        ready && "ops-kitchen-ready",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="ops-kitchen-number font-display leading-none text-primary">
            #{pedido.num}
          </div>
          <div className="ops-kitchen-type mt-2 flex items-center gap-1.5 text-muted">
            <TipoIcon className="h-4 w-4" />
            {tipo.label}
            {pedido.nombre ? ` · ${pedido.nombre}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {ready ? (
            <p className="ops-ready-label">
              Listo para
              <br />
              entregar
            </p>
          ) : (
            <>
              <span
                className={cn(
                  "ops-kitchen-timer inline-flex items-center gap-2 rounded-lg px-3 py-1 text-2xl font-bold tabular-nums",
                  color.chip,
                )}
              >
                <Clock className="h-5 w-5" />
                {fmt(seg)}
              </span>
              <p className="ops-urgency">{urgencyLabel}</p>
              {pedido.demora != null && (
                <div className="mt-1 text-sm text-muted">demora {pedido.demora} min</div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border" />

      <ul className="ops-kitchen-items flex flex-col gap-3">
        {pedido.items.map((it, i) => (
          <li key={i} className="flex items-baseline gap-3 text-2xl text-text">
            <span className="shrink-0 rounded-md bg-surface3 px-2.5 py-0.5 text-xl font-bold text-primary">
              {it.cantidad}×
            </span>
            <span>
              {it.nombre}
              {it.variante && (
                <span className="ops-kitchen-variant text-lg text-muted"> · {it.variante}</span>
              )}
              {it.obs && <span className="ops-kitchen-note">{it.obs}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
