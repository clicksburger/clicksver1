import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const load = (file, overrides = {}) => {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => (name.endsWith(".css") ? {} : (overrides[name] ?? require(name))),
    Intl,
    Date,
  });
  return exports;
};
const helpers = load("src/features/orders/ticket.ts");
const base = {
  num: 99,
  tipo: "delivery",
  nombre: "Cliente de prueba",
  estado: "listo",
  creadoEn: "2026-10-30T02:50:00Z",
  horaConfirmado: "2026-10-30T02:55:00Z",
  demora: 15,
  items: [
    { nombre: "Burger", cantidad: 2, precio: 14000, variante: "Doble", obs: "Sin cebolla" },
    { nombre: "Papas", cantidad: 1, precio: 3500, variante: null },
  ],
  checkout: {
    version: 1,
    telefono: "3515550100",
    direccion: "Calle de prueba 123, Córdoba",
    referencia: "Timbre A",
    pago: "transferencia",
  },
};
const result = helpers.ticketSummary(base);
assert.equal(result.productsTotal, 31500);
assert.equal(result.units, 3);
assert.equal(result.missingAddress, false);
assert.ok(result.created.includes("29/10/26"));
assert.ok(result.estimated.includes("30/10/26"));
assert.ok(result.estimated.includes("00:10"));
assert.equal(helpers.ticketSummary({ ...base, checkout: undefined }).missingAddress, true);
assert.equal(
  helpers.ticketSummary({ ...base, tipo: "takeaway", checkout: undefined }).missingAddress,
  false,
);
assert.equal(helpers.ticketSummary({ ...base, horaConfirmado: null }).estimated, null);
const { Ticket } = load("src/features/orders/components/Ticket.tsx", {
  "@/lib/format": { formatPrecio: (n) => `$${n}` },
  "@/constants/order-states": { ESTADO_LABEL: { listo: "Listo" } },
  "../ticket": helpers,
});
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const html = renderToStaticMarkup(
  React.createElement(Ticket, { pedido: base, tenantNombre: "Clicks Burger" }),
);
for (const text of [
  "3515550100",
  "Calle de prueba 123",
  "Timbre A",
  "Transferencia",
  "31500",
  "28000",
  "3500",
  "Sin cebolla",
  "Doble",
  "Pago pendiente",
  "Envío a confirmar",
])
  assert.ok(html.includes(text), `Falta ${text} en el ticket`);
const legacy = renderToStaticMarkup(
  React.createElement(Ticket, {
    pedido: { ...base, checkout: undefined },
    tenantNombre: "Clicks Burger",
  }),
);
assert.ok(legacy.includes("Confirmar dirección y contacto con caja"));
assert.equal(
  (html.match(/class="ticket-paper"/g) ?? []).length,
  1,
  "Pantalla e impresión usan el mismo comprobante",
);
console.log(
  "Ticket: totales, cantidades, fecha de Buenos Aires, cruce de medianoche, datos de reparto y pedidos antiguos verificados.",
);
