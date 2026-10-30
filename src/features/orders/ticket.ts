import type { Pedido } from "@/types/domain";
import { envioPendiente } from "@/features/envios/tarifas";

export function ticketSummary(pedido: Pedido) {
  const productsTotal = pedido.items.reduce(
    (total, item) => total + Number(item.precio) * Number(item.cantidad),
    0,
  );
  const date = (value: string) =>
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      dateStyle: "short",
      timeStyle: "short",
      hourCycle: "h23",
    }).format(new Date(value));
  const envio = pedido.costoEnvio;
  return {
    productsTotal,
    envio,
    envioPendiente: envioPendiente(pedido),
    total: productsTotal + (envio ?? 0),
    envioInfo: pedido.checkout?.envio,
    units: pedido.items.reduce((count, item) => count + item.cantidad, 0),
    created: date(pedido.creadoEn),
    confirmed: pedido.horaConfirmado ? date(pedido.horaConfirmado) : null,
    estimated:
      pedido.horaConfirmado && pedido.demora != null
        ? date(
            new Date(
              new Date(pedido.horaConfirmado).getTime() + pedido.demora * 60000,
            ).toISOString(),
          )
        : null,
    delivery: pedido.tipo === "delivery",
    missingAddress: pedido.tipo === "delivery" && !pedido.checkout?.direccion,
  };
}
