import type { Pedido } from "@/types/domain";

/**
 * Reporte de un turno de caja en CSV para Excel (separador ";" y BOM UTF-8,
 * como lo espera Excel en español). Funciones puras: se pueden probar sin base.
 */
export interface TurnoResumen {
  abierto_en: string;
  cerrado_en: string | null;
  abierto_por_email: string | null;
  monto_inicial: number | string;
  monto_final: number | string | null;
  ventas: number | string | null;
  pedidos_count: number | null;
  diferencia: number | string | null;
  nota_apertura: string | null;
  nota_cierre: string | null;
}

const TZ = "America/Argentina/Buenos_Aires";
const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "";
const TIPO: Record<string, string> = { delivery: "Delivery", takeaway: "Retiro", salon: "Salón" };
const PAGO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia" };

export const totalPedido = (p: Pedido) =>
  p.items.reduce((sum, it) => sum + Number(it.precio) * Number(it.cantidad), 0);

/** Momento que cuenta para las ventas: la entrega (igual que caja_ventas en la base). */
export const momentoVenta = (p: Pedido) => p.horaEntregado ?? p.creadoEn;

/** Pedidos entregados dentro del turno [desde, hasta). */
export function ventasDelTurno(pedidos: Pedido[], desde: string, hasta: string | null) {
  const start = new Date(desde).getTime();
  const end = hasta ? new Date(hasta).getTime() : Infinity;
  return pedidos
    .filter((p) => p.estado === "entregado")
    .filter((p) => {
      const t = new Date(momentoVenta(p)).getTime();
      return t >= start && t < end;
    })
    .sort((a, b) => a.num - b.num);
}

/** Celda segura: entrecomillada y sin fórmulas al abrir en Excel. */
function cell(value: string | number | null | undefined) {
  if (typeof value === "number") return String(Math.round(value * 100) / 100).replace(".", ",");
  return `"${String(value ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""')}"`;
}

export function turnoCsv(turno: TurnoResumen, entregados: Pedido[]) {
  const ventas = entregados.reduce((s, p) => s + totalPedido(p), 0);
  const porPago = new Map<string, { pedidos: number; total: number }>();
  const productos = new Map<string, { nombre: string; unidades: number; total: number }>();
  for (const p of entregados) {
    const pago = PAGO[p.checkout?.pago ?? ""] ?? "Sin dato";
    const fila = porPago.get(pago) ?? { pedidos: 0, total: 0 };
    fila.pedidos += 1;
    fila.total += totalPedido(p);
    porPago.set(pago, fila);
    for (const it of p.items) {
      const nombre = it.nombre + (it.variante ? ` · ${it.variante}` : "");
      const prod = productos.get(nombre) ?? { nombre, unidades: 0, total: 0 };
      prod.unidades += Number(it.cantidad);
      prod.total += Number(it.precio) * Number(it.cantidad);
      productos.set(nombre, prod);
    }
  }
  const rows: (string | number | null)[][] = [
    ["Clicks Burger — Turno de caja"],
    ["Apertura", fecha(turno.abierto_en)],
    ["Cierre", turno.cerrado_en ? fecha(turno.cerrado_en) : "Turno abierto"],
    ["Usuario", turno.abierto_por_email ?? ""],
    ["Fondo inicial", Number(turno.monto_inicial)],
    ["Ventas (pedidos entregados)", ventas],
    ["Pedidos entregados", entregados.length],
    ["Esperado en caja", Number(turno.monto_inicial) + ventas],
    ["Contado", turno.monto_final == null ? "" : Number(turno.monto_final)],
    ["Diferencia", turno.diferencia == null ? "" : Number(turno.diferencia)],
    ["Nota de apertura", turno.nota_apertura ?? ""],
    ["Nota de cierre", turno.nota_cierre ?? ""],
    [],
    ["Forma de pago", "Pedidos", "Total ARS"],
    ...[...porPago.entries()].map(([pago, f]) => [pago, f.pedidos, f.total]),
    [],
    ["Producto", "Unidades", "Total ARS"],
    ...[...productos.values()]
      .sort((a, b) => b.unidades - a.unidades)
      .map((p) => [p.nombre, p.unidades, p.total]),
    [],
    [
      "Pedido",
      "Ingreso",
      "Entrega",
      "Cliente",
      "Teléfono",
      "Modalidad",
      "Pago",
      "Productos",
      "Total ARS",
    ],
    ...entregados.map((p) => [
      p.num,
      fecha(p.creadoEn),
      fecha(p.horaEntregado),
      p.nombre ?? "",
      p.checkout?.telefono ?? "",
      TIPO[p.tipo] ?? p.tipo,
      PAGO[p.checkout?.pago ?? ""] ?? "",
      p.items
        .map(
          (it) =>
            `${it.cantidad} × ${it.nombre}${it.variante ? ` (${it.variante})` : ""}${it.obs ? ` [${it.obs}]` : ""}`,
        )
        .join(" | "),
      totalPedido(p),
    ]),
  ];
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}

export function turnoArchivo(turno: Pick<TurnoResumen, "abierto_en">) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(turno.abierto_en));
  const v = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `clicks-turno-${v("year")}-${v("month")}-${v("day")}_${v("hour")}${v("minute")}.csv`;
}

/** Descarga un texto como archivo desde el navegador. */
export function descargarArchivo(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
