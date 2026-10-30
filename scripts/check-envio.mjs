// Pruebas del envío por distancia: tramos, distancia y mensaje de WhatsApp.
// Uso: node scripts/check-envio.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => overrides[name] ?? require(name),
    process,
    Intl,
    Date,
    URL,
  });
  return exports;
}

const tarifas = load("src/features/envios/tarifas.ts");
const checkout = load("src/features/orders/checkout.ts", {
  "@/features/envios/tarifas": tarifas,
});
const { TRAMOS_DEFAULT: T, costoPorDistancia, distanciaKm, cotizar, envioConfigFromJson } = tarifas;

// Tramos pedidos por Clicks: <=1 km $1000 · <=2,5 $1500 · <=3,5 $2000 · <=4,5 $3000 · más: a confirmar
const casos = [
  [0.2, 1000], [1, 1000], [1.01, 1500], [1.5, 1500], [2.5, 1500], [2.51, 2000],
  [3.5, 2000], [3.6, 3000], [4.5, 3000], [4.51, null], [12, null],
];
for (const [km, esperado] of casos) assert.equal(costoPorDistancia(km, T), esperado, `${km} km`);

// Haversine: 0,01° de latitud ≈ 1,11 km.
const d = distanciaKm({ lat: -31.4, lng: -64.2 }, { lat: -31.41, lng: -64.2 });
assert.ok(Math.abs(d - 1.112) < 0.01, `distancia ${d}`);

const local = { direccion: "Local", lat: -31.4, lng: -64.2, tramos: T };
const cerca = cotizar(local, { lat: -31.41, lng: -64.2, direccion: "Cliente cerca" });
assert.equal(cerca.estado, "calculado");
assert.equal(cerca.costo, 1500);
const lejos = cotizar(local, { lat: -31.45, lng: -64.2, direccion: "Cliente lejos" });
assert.equal(lejos.estado, "a_confirmar");
assert.equal(lejos.motivo, "fuera_de_rango");
assert.equal(lejos.costo, null);

// JSON guardado: ordena tramos y descarta inválidos.
const cfg = envioConfigFromJson({
  direccion: " Fray Luis Beltrán 2735 ",
  tramos: [{ hastaKm: 2.5, costo: 1500 }, { hastaKm: 1, costo: 1000 }, { hastaKm: "x", costo: 1 }],
});
assert.deepEqual(cfg.tramos.map((t) => t.hastaKm), [1, 2.5]);
assert.equal(cfg.direccion, "Fray Luis Beltrán 2735");
assert.equal(cfg.lat, null);
assert.equal(envioConfigFromJson(null), null);

// Totales con envío.
const pedido = { tipo: "delivery", costoEnvio: 1500, items: [{ precio: 11500, cantidad: 2 }] };
assert.equal(tarifas.totalConEnvio(pedido), 24500);
assert.equal(tarifas.envioPendiente({ tipo: "delivery", costoEnvio: null }), true);
assert.equal(tarifas.envioPendiente({ tipo: "takeaway", costoEnvio: null }), false);

// Mensaje de WhatsApp.
const items = [{ itemId: "x", nombre: "CRISPY CLICKS", variante: "Doble", cantidad: 1, precio: 14500 }];
const base = { version: 1, telefono: "3511234567", direccion: "Calle 123", referencia: null, pago: "efectivo", requestHash: "h" };
const conEnvio = checkout.whatsappMessage(7, "Ana", "delivery", items, { ...base, envio: cerca });
assert.match(conEnvio, /Envío \(1,1 km\): \$\s?1\.500/);
assert.match(conEnvio, /\*Total a pagar: \$\s?16\.000\*/);
assert.match(conEnvio, /Ubicación: https:\/\/www\.google\.com\/maps/);
const aConfirmar = checkout.whatsappMessage(8, "Ana", "delivery", items, { ...base, envio: lejos });
assert.match(aConfirmar, /Envío: \*A CONFIRMAR\* \(la dirección está fuera de nuestra zona de envío habitual\)/);
assert.match(aConfirmar, /confirmame el costo del envío/);
assert.doesNotMatch(aConfirmar, /Total a pagar/);
const retiro = checkout.whatsappMessage(9, "Ana", "takeaway", items, { ...base, direccion: null });
assert.match(retiro, /\*Total a pagar: \$\s?14\.500\*/);
assert.doesNotMatch(retiro, /Envío:/);

// El checkout acepta expectedEnvio opcional.
const parsed = checkout.checkoutSchema.safeParse({
  expectedTotal: 14500, expectedEnvio: 1500, requestId: "4f1f0e6e-8f0a-4b6a-9d55-0d2f3b8a1c11",
  nombre: "Ana López", telefono: "351 123 4567", tipo: "delivery", direccion: "Calle 123",
  pago: "efectivo", items: [{ itemId: "4f1f0e6e-8f0a-4b6a-9d55-0d2f3b8a1c12", variante: null, cantidad: 1 }],
});
assert.ok(parsed.success);

console.log("check-envio: OK");
console.log("\n--- Ejemplo de mensaje ---\n" + conEnvio + "\n\n--- A confirmar ---\n" + aConfirmar);
