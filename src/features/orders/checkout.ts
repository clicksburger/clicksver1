import { z } from "zod";
import type { CheckoutDetails, MenuItem, PedidoItem } from "@/types/domain";

const phone = z
  .string()
  .trim()
  .max(30)
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value.length >= 8 && value.length <= 15, "Ingresá un teléfono válido.");
export const checkoutSchema = z
  .object({
    expectedTotal: z.number().finite().min(0),
    requestId: z.string().uuid(),
    nombre: z.string().trim().min(3, "Ingresá tu nombre y apellido.").max(100),
    telefono: phone,
    tipo: z.enum(["takeaway", "delivery"]),
    direccion: z.string().trim().max(240).default(""),
    referencia: z.string().trim().max(150).default(""),
    pago: z.enum(["efectivo", "transferencia"]),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          variante: z.string().max(200).nullable(),
          cantidad: z.number().int().min(1).max(50),
          obs: z.string().trim().max(150).optional(),
        }),
      )
      .min(1, "Agregá productos al pedido.")
      .max(50),
  })
  .superRefine((value, context) => {
    if (value.tipo === "delivery" && value.direccion.length < 5)
      context.addIssue({
        code: "custom",
        path: ["direccion"],
        message: "Ingresá la dirección de entrega.",
      });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** El catálogo del servidor determina nombres, opciones y precios. */
export function priceCheckout(input: CheckoutInput, menu: MenuItem[]): PedidoItem[] {
  return input.items.map((line) => {
    const product = menu.find((item) => item.id === line.itemId && item.activo);
    if (!product) throw new Error("Un producto dejó de estar disponible. Revisá el carrito.");
    let precio = product.precio;
    let variante: string | null = null;
    if (product.variantes.length) {
      const labels = line.variante?.split(" + ") ?? [];
      const selected = product.variantes.filter((option) => labels.includes(option.label));
      const dip = product.nombre.trim().toUpperCase() === "DIP DE SALSAS";
      if (
        !labels.length ||
        new Set(labels).size !== labels.length ||
        selected.length !== labels.length ||
        (!dip && labels.length !== 1)
      )
        throw new Error(`Revisá las opciones de ${product.nombre}.`);
      if (dip && selected.some((option) => option.precio !== selected[0]?.precio))
        throw new Error("El dip necesita revisión de precios antes de confirmar.");
      precio = selected[0]!.precio;
      variante = selected.map((option) => option.label).join(" + ");
    } else if (line.variante) throw new Error(`El producto ${product.nombre} no tiene esa opción.`);
    if (precio == null || !Number.isFinite(precio) || precio < 0)
      throw new Error(`Precio no disponible para ${product.nombre}.`);
    return {
      itemId: product.id,
      nombre: product.nombre,
      variante,
      precio,
      cantidad: line.cantidad,
      ...(line.obs ? { obs: line.obs } : {}),
    };
  });
}

/** Metadatos versionados en el primer ítem JSONB, compatibles con el esquema actual. */
export function attachCheckout(items: PedidoItem[], checkout?: CheckoutDetails): PedidoItem[] {
  return items.map((item, index) => {
    const { checkout: previous, ...clean } = item;
    void previous;
    return index === 0 && checkout ? { ...clean, checkout } : clean;
  });
}
export function readCheckout(items: PedidoItem[]): CheckoutDetails | undefined {
  return items.find((item) => item.checkout?.version === 1)?.checkout;
}

export function whatsappMessage(
  num: number,
  nombre: string,
  tipo: string,
  items: PedidoItem[],
  checkout: CheckoutDetails,
): string {
  const money = (amount: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  return [
    `Hola Clicks! Pedido #${num}`,
    `Nombre: ${nombre}`,
    `Teléfono: ${checkout.telefono}`,
    `Entrega: ${tipo === "delivery" ? "Envío a domicilio" : "Retiro en el local"}`,
    ...(tipo === "delivery"
      ? [
          `Dirección: ${checkout.direccion}`,
          ...(checkout.referencia ? [`Referencia: ${checkout.referencia}`] : []),
        ]
      : []),
    `Forma de pago: ${checkout.pago === "efectivo" ? "Efectivo" : "Transferencia"} (pendiente)`,
    "",
    ...items.map(
      (item) =>
        `${item.cantidad} × ${item.nombre}${item.variante ? ` (${item.variante})` : ""} — ${money(item.precio * item.cantidad)}${item.obs ? `\n  Observación: ${item.obs}` : ""}`,
    ),
    "",
    `Total de productos: ${money(items.reduce((sum, item) => sum + item.precio * item.cantidad, 0))}`,
    ...(tipo === "delivery"
      ? ["Costo de envío a confirmar según dirección; no incluido en el total."]
      : []),
    "El pedido ya está registrado en el sistema. Quedo a la espera de confirmación del local.",
  ].join("\n");
}
