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

const source = fs.readFileSync(
  new URL("../src/features/dashboard/summary.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exported = {};
vm.runInNewContext(compiled.outputText, {
  exports: exported,
  require: requireTarifas,
  Intl,
  Date,
  Map,
});
const { periodStart, summarize } = exported;

// UTC ya es 30/10, pero en Buenos Aires todavía es 29/10.
assert.equal(periodStart(1, new Date("2026-10-30T01:30:00Z")), "2026-10-29T03:00:00.000Z");
assert.equal(periodStart(7, new Date("2026-11-02T15:00:00Z")), "2026-10-27T03:00:00.000Z");
const item = {
  itemId: "burger",
  nombre: "Cheeseburger",
  variante: "Doble",
  precio: 7500,
  cantidad: 2,
};
const summary = summarize([
  { estado: "entregado", items: [item] },
  {
    estado: "entregado",
    items: [
      { ...item, precio: 8000, cantidad: 1 },
      { ...item, variante: "Simple", precio: 6000, cantidad: 1 },
    ],
  },
  { estado: "rechazado", items: [{ ...item, cantidad: 100 }] },
  { estado: "en_cocina", items: [item] },
]);
assert.equal(summary.revenue, 29000);
assert.equal(summary.average, 14500);
assert.equal(summary.units, 4);
assert.equal(summary.delivered.length, 2);
assert.equal(summary.products.length, 2);
assert.equal(summary.products[0].quantity, 3);
assert.equal(summary.products[0].revenue, 23000);
assert.equal(summarize([]).average, 0);
console.log(
  "Dashboard: fechas de Buenos Aires, períodos, ventas, variantes y estados verificados.",
);
