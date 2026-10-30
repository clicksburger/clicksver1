import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Módulo de envíos (lo usan los totales): se transpila y se inyecta como dependencia.
const tarifas = (() => {
  const out = ts.transpileModule(
    fs.readFileSync(new URL("../src/features/envios/tarifas.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, Intl, Math, Number });
  return exports;
})();
const requireTarifas = (name) => {
  if (name === "@/features/envios/tarifas") return tarifas;
  throw new Error(`Dependencia no simulada: ${name}`);
};

// Reporte del turno de caja: qué ventas entran y cómo queda el Excel (CSV).
const source = fs.readFileSync(
  new URL("../src/features/caja/turno-report.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exported = {};
vm.runInThisContext(`(function (exports, require) {${outputText}\n})`)(exported, requireTarifas);
const { ventasDelTurno, turnoCsv, turnoArchivo, totalPedido } = exported;

const item = (nombre, precio, cantidad, extra = {}) => ({
  itemId: nombre,
  nombre,
  variante: null,
  precio,
  cantidad,
  ...extra,
});
const pedido = (num, estado, horaEntregado, items, pago = "efectivo", extra = {}) => ({
  id: String(num),
  num,
  estado,
  tipo: "delivery",
  nombre: `Cliente ${num}`,
  items,
  horaEntregado,
  creadoEn: "2026-10-30T21:00:00.000Z",
  checkout: { version: 1, telefono: "3510000000", pago },
  ...extra,
});
const abierto = "2026-10-30T22:00:00.000Z"; // 19:00 en Buenos Aires
const cerrado = "2026-10-31T05:00:00.000Z"; // 02:00 del día siguiente
const pedidos = [
  pedido(1, "entregado", "2026-10-30T21:59:00.000Z", [item("Antes", 1000, 1)]), // turno anterior
  pedido(2, "entregado", "2026-10-30T23:10:00.000Z", [
    item("CHEESEBURGER", 11000, 2, { variante: "Doble", obs: "sin cebolla" }),
  ]),
  pedido(
    3,
    "entregado",
    "2026-10-31T04:59:00.000Z",
    [item("PAPAS FRITAS", 3500, 1)],
    "transferencia",
  ),
  pedido(4, "listo", null, [item("No entregado", 9000, 1)]),
  pedido(5, "entregado", "2026-10-31T05:00:00.000Z", [item("Después", 500, 1)]), // justo al cerrar: no cuenta
  pedido(6, "entregado", "2026-10-31T01:00:00.000Z", [item("=HYPERLINK(1)", 2500, 2)], "efectivo", {
    nombre: "+peligro",
  }),
];

const enTurno = ventasDelTurno(pedidos, abierto, cerrado);
assert.deepEqual(
  enTurno.map((p) => p.num),
  [2, 3, 6],
  "Solo entregados dentro del turno, por número",
);
assert.equal(
  enTurno.reduce((s, p) => s + totalPedido(p), 0),
  30500,
);
assert.deepEqual(
  ventasDelTurno(pedidos, abierto, null).map((p) => p.num),
  [2, 3, 5, 6],
  "Turno abierto: hasta ahora",
);

const turno = {
  abierto_en: abierto,
  cerrado_en: cerrado,
  abierto_por_email: "caja@clicks.com",
  monto_inicial: "20000",
  monto_final: "50000",
  ventas: "30500",
  pedidos_count: 3,
  diferencia: "-500",
  nota_apertura: null,
  nota_cierre: "Faltan $500",
};
const csv = turnoCsv(turno, enTurno);
assert.ok(csv.startsWith("﻿"), "BOM para que Excel lea los acentos");
const lines = csv.slice(1).split("\r\n");
const row = (label) => lines.find((l) => l.startsWith(`"${label}"`));
assert.equal(row("Ventas (pedidos entregados)"), '"Ventas (pedidos entregados)";30500');
assert.equal(row("Esperado en caja"), '"Esperado en caja";50500');
assert.equal(row("Diferencia"), '"Diferencia";-500');
assert.equal(row("Efectivo"), '"Efectivo";2;27000', "Ventas en efectivo para el arqueo");
assert.equal(row("Transferencia"), '"Transferencia";1;3500');
assert.equal(row("CHEESEBURGER · Doble"), '"CHEESEBURGER · Doble";2;22000');
assert.ok(csv.includes('"\'+peligro"') && csv.includes('"\'=HYPERLINK(1)"'), "Neutraliza fórmulas");
assert.ok(csv.includes("[sin cebolla]"), "Incluye observaciones");
assert.equal(
  turnoArchivo(turno),
  "clicks-turno-2026-10-30_1900.csv",
  "Nombre con hora de Buenos Aires",
);
console.log(
  "Turno: ventas por hora de entrega, totales, formas de pago, productos y Excel verificados.",
);
