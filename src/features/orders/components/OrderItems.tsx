import { formatPrecio } from "@/lib/format";
import type { PedidoItem } from "@/types/domain";

export function OrderItems({
  items,
  showPrecio = true,
}: {
  items: PedidoItem[];
  showPrecio?: boolean;
}) {
  return (
    <ul className="ops-item-list flex flex-col gap-1">
      {items.map((it, i) => (
        <li key={i} className="flex items-start justify-between gap-2 text-sm">
          <span className="text-text">
            <span className="font-bold text-primary">{it.cantidad}×</span> {it.nombre}
            {it.variante && <span className="text-muted"> · {it.variante}</span>}
            {it.obs && (
              <span className="ops-item-note block text-xs italic text-muted">“{it.obs}”</span>
            )}
          </span>
          {showPrecio && (
            <span className="shrink-0 text-muted">{formatPrecio(it.precio * it.cantidad)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
