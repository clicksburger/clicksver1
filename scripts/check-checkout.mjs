import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
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
const checkout = load("src/features/orders/checkout.ts");
const horarios = load("src/features/tenants/horarios.ts");
const productId = randomUUID(),
  dipId = randomUUID(),
  tenantId = randomUUID();
const menu = [
  { id: productId, nombre: "PAPAS FRITAS", activo: true, precio: 3500, variantes: [] },
  {
    id: dipId,
    nombre: "DIP DE SALSAS",
    activo: true,
    precio: null,
    variantes: [
      { label: "Mayo Clicks", precio: 500 },
      { label: "Ketchup", precio: 500 },
    ],
  },
];
const body = {
  expectedTotal: 7500,
  requestId: randomUUID(),
  nombre: "Cliente de prueba",
  telefono: "351 555 0100",
  tipo: "delivery",
  direccion: "Calle de prueba 123",
  referencia: "Timbre A",
  pago: "efectivo",
  items: [
    { itemId: productId, variante: null, cantidad: 2, precio: 1, obs: "Sin sal" },
    { itemId: dipId, variante: "Mayo Clicks + Ketchup", cantidad: 1 },
  ],
};
const parsed = checkout.checkoutSchema.parse(body);
assert.equal(parsed.telefono, "3515550100");
assert.equal(parsed.items[0].precio, undefined);
const priced = checkout.priceCheckout(parsed, menu);
assert.equal(
  priced.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
  7500,
);
assert.equal(checkout.checkoutSchema.safeParse({ ...body, direccion: "" }).success, false);
assert.equal(checkout.checkoutSchema.safeParse({ ...body, pago: "tarjeta" }).success, false);
assert.equal(checkout.checkoutSchema.safeParse({ ...body, items: [] }).success, false);
assert.throws(() =>
  checkout.priceCheckout(
    { ...parsed, items: [{ ...parsed.items[0], itemId: randomUUID() }] },
    menu,
  ),
);
assert.throws(() =>
  checkout.priceCheckout(
    { ...parsed, items: [{ ...parsed.items[1], variante: "Salsa inventada" }] },
    menu,
  ),
);

const rows = [];
let closed = false;
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
  }
  select() {
    return this;
  }
  eq(key, value) {
    this.filters.push((row) => row[key] === value);
    return this;
  }
  order(key, options) {
    this.sort = { key, ascending: options?.ascending };
    return this;
  }
  limit(value) {
    this.max = value;
    return this;
  }
  insert(row) {
    this.insertion = row;
    return this;
  }
  execute() {
    if (this.insertion) {
      if (rows.some((row) => row.id === this.insertion.id || row.num === this.insertion.num))
        return { data: null, error: { code: "23505" } };
      rows.push(structuredClone(this.insertion));
      return { data: null, error: null };
    }
    let data =
      this.table === "tenants"
        ? [
            {
              id: tenantId,
              slug: "clicks-burger",
              activo: true,
              horarios: closed
                ? Array.from({ length: 7 }, (_, dia) => ({
                    dia,
                    abierto: false,
                    abre: "00:00",
                    cierra: "00:00",
                  }))
                : null,
            },
          ]
        : this.table === "pedidos"
          ? rows
          : [];
    data = data.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.sort)
      data = [...data].sort(
        (a, b) => (a[this.sort.key] - b[this.sort.key]) * (this.sort.ascending ? 1 : -1),
      );
    if (this.max) data = data.slice(0, this.max);
    return { data, error: null };
  }
  single() {
    const result = this.execute();
    return Promise.resolve({ ...result, data: result.data?.[0] ?? null });
  }
  maybeSingle() {
    return this.single();
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}
const db = { from: (table) => new Query(table) };
const route = load("src/app/api/checkout/route.ts", {
  "@/services/supabase/admin": { createSupabaseAdminClient: () => db },
  "@/constants/business": { BUSINESS_SLUG: "clicks-burger" },
  "@/features/orders/checkout": checkout,
  "@/features/menu/mappers": { mapMenu: () => menu },
  "@/features/tenants/mappers": { mapTenant: (tenant) => tenant },
  "@/features/tenants/horarios": horarios,
});
const request = (value, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(value),
  });
const [first, repeat] = await Promise.all([route.POST(request(body)), route.POST(request(body))]);
assert.equal(first.status, 200);
assert.equal(repeat.status, 200);
assert.equal(rows.length, 1);
const receipt = await first.json();
assert.equal(receipt.num, 1);
assert.equal(receipt.total, 7500);
assert.equal(new URL(receipt.whatsappUrl).pathname, "/543518737099");
const message = new URL(receipt.whatsappUrl).searchParams.get("text");
assert.ok(
  message.includes("Sin sal") &&
    message.includes("Calle de prueba 123") &&
    message.includes("pendiente") &&
    message.includes("envío a confirmar"),
);
assert.equal(checkout.readCheckout(rows[0].items).telefono, "3515550100");
assert.equal((await route.POST(request({ ...body, nombre: "Otro cliente" }))).status, 409);
assert.equal(rows.length, 1);
assert.equal((await route.POST(request(body, "https://otra-web.example"))).status, 403);
assert.equal(
  (await route.POST(request({ ...body, requestId: randomUUID(), direccion: "" }))).status,
  400,
);
assert.equal((await route.POST(request({ ...body, requestId: randomUUID(), expectedTotal: 1 }))).status, 409, "Pide revisar la carta si cambió el total");
assert.equal(rows.length, 1, "No registra un pedido con un total no aceptado");
const other = { ...body, requestId: randomUUID(), tipo: "takeaway", direccion: "" };
assert.equal((await route.POST(request(other))).status, 200);
assert.equal(rows.length, 2);
closed = true;
assert.equal((await route.POST(request({ ...body, requestId: randomUUID() }))).status, 409);
assert.equal(
  (await route.POST(request(body))).status,
  200,
  "Recupera pedidos existentes aun con el local cerrado",
);
assert.equal(rows.length, 2);
const nights = Array.from({ length: 7 }, (_, dia) => ({
  dia,
  abierto: true,
  abre: "20:00",
  cierra: "00:30",
}));
assert.equal(horarios.estaAbierto(nights, new Date("2026-10-30T03:15:00Z")), true);
assert.equal(horarios.estaAbierto(nights, new Date("2026-10-30T03:31:00Z")), false);
console.log(
  "Checkout: API con base simulada, validación, precios del servidor, reintentos concurrentes, datos del cliente, WhatsApp y horarios verificados. No se crearon pedidos reales.",
);
