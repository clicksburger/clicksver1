import Link from "next/link";
import { Clock, Printer } from "lucide-react";
import { horaCorta, formatPrecio } from "@/lib/format";
import { EstadoBadge } from "./EstadoBadge";
import { OrderItems } from "./OrderItems";
import { OrderContact } from "./OrderContact";
import type { Pedido } from "@/types/domain";
import { envioPendiente, totalConEnvio, totalProductos } from "@/features/envios/tarifas";

const TIPO_LABEL: Record<string, string> = {
  delivery: "Delivery",
  salon: "Salón",
  takeaway: "Take away",
};

export function OrderCard({
  pedido,
  printHref,
  children,
}: {
  pedido: Pedido;
  printHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="ops-order flex flex-col rounded-xl border border-border bg-surface"
      data-state={pedido.estado}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="ops-order-number font-display tracking-wide text-primary">
            #{pedido.num}
          </span>
          {pedido.nombre && <p className="ops-order-name text-text">{pedido.nombre}</p>}
          <p className="text-xs text-muted">{TIPO_LABEL[pedido.tipo] ?? pedido.tipo}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {printHref && (
              <Link
                href={printHref}
                target="_blank"
                className="ops-print inline-flex items-center gap-1 rounded-lg bg-primary font-bold text-bg transition hover:opacity-90"
                aria-label="Imprimir ticket"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Link>
            )}
            <div className="ops-state">
              <EstadoBadge estado={pedido.estado} />
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted">
            <Clock className="h-3 w-3" /> {horaCorta(pedido.creadoEn)}
          </span>
          {pedido.demora != null && (
            <span className="text-xs text-muted">⏱ {pedido.demora} min</span>
          )}
        </div>
      </div>

      <OrderItems items={pedido.items} />
      <OrderContact checkout={pedido.checkout} costoEnvio={pedido.costoEnvio} />
      {pedido.tipo === "delivery" && (
        <div className="ops-order-total text-xs">
          <span>Envío</span>
          <span>
            {envioPendiente(pedido) ? "A confirmar" : formatPrecio(pedido.costoEnvio ?? 0)}
          </span>
        </div>
      )}
      <div className="ops-order-total">
        <span>{envioPendiente(pedido) ? "Total de productos" : "Total"}</span>
        <span>
          {formatPrecio(
            envioPendiente(pedido) ? totalProductos(pedido.items) : totalConEnvio(pedido),
          )}
        </span>
      </div>

      {children && (
        <div className="ops-order-actions flex flex-wrap border-t border-border pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
