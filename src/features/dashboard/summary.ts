import type { Pedido } from "@/types/domain";
import { envioDe, totalConEnvio } from "@/features/envios/tarifas";

export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

/** Total del pedido: productos + envío (igual criterio que el cierre de caja). */
export const orderTotal = (order: Pedido) => totalConEnvio(order);

/** Días calendario de Buenos Aires, incluyendo hoy. El huso del navegador no interviene. */
export function periodStart(days: number, now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const start = new Date(`${day}T00:00:00-03:00`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return start.toISOString();
}

export function summarize(orders: Pedido[]) {
  const delivered = orders.filter((order) => order.estado === "entregado");
  const revenue = delivered.reduce((total, order) => total + orderTotal(order), 0);
  const envios = delivered.reduce((total, order) => total + envioDe(order), 0);
  const products = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of delivered) {
    for (const item of order.items) {
      const key = JSON.stringify([item.itemId, item.variante]);
      const product = products.get(key) ?? {
        name: item.nombre + (item.variante ? ` · ${item.variante}` : ""),
        quantity: 0,
        revenue: 0,
      };
      product.quantity += Number(item.cantidad);
      product.revenue += Number(item.precio) * Number(item.cantidad);
      products.set(key, product);
    }
  }
  return {
    delivered,
    revenue,
    envios,
    average: delivered.length ? revenue / delivered.length : 0,
    units: [...products.values()].reduce((total, product) => total + product.quantity, 0),
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity),
  };
}
