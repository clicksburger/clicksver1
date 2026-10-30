import { Badge, type BadgeTone } from "@/components/ui";
import { ESTADO_LABEL, type EstadoPedido } from "@/constants/order-states";

export const ESTADO_TONE: Record<EstadoPedido, BadgeTone> = {
  nuevo: "info",
  confirmado: "primary",
  en_cocina: "warning",
  listo: "success",
  entregado: "neutral",
  rechazado: "danger",
};

export function EstadoBadge({ estado }: { estado: EstadoPedido }) {
  return <Badge tone={ESTADO_TONE[estado]}>{ESTADO_LABEL[estado]}</Badge>;
}
