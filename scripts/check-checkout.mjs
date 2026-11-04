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
const tarifas = load("src/features/envios/tarifas.ts");
const promos = load("src/features/menu/promos.ts");
const checkout = load("src/features/orders/checkout.ts", {
  "@/features/envios/tarifas": tarifas,
  "@/constants/business": load("src/constants/business.ts"),
  "@/features/menu/promos": promos,
});
// El envío se simula: por defecto "a confirmar" (sin clave de Google).
let cotizacionEnvio = tarifas.aConfirmar("no_disponible");
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

// Promos con vencimiento: día comercial de Buenos Aires con corte a las 06:00.
const at = (iso) => new Date(iso);
assert.equal(promos.diaComercial(at("2026-11-01T23:30:00-03:00")), "2026-11-01");
assert.equal(promos.diaComercial(at("2026-11-02T02:00:00-03:00")), "2026-11-01");
assert.equal(promos.diaComercial(at("2026-11-02T06:30:00-03:00")), "2026-11-02");
const promo = { vigenteHasta: "2026-11-01" };
assert.equal(promos.estaVigente(promo, at("2026-10-31T21:00:00-03:00")), true);
assert.equal(promos.estaVigente(promo, at("2026-11-02T01:00:00-03:00")), true);
assert.equal(promos.estaVigente(promo, at("2026-11-02T07:00:00-03:00")), false);
assert.equal(promos.estaVigente({ vigenteHasta: null }), true);
assert.equal(promos.diasRestantes("2026-11-01", at("2026-10-31T12:00:00-03:00")), 2);
assert.equal(promos.textoVigencia("2026-11-01", at("2026-11-01T12:00:00-03:00")), "Último día");
const vencida = {
  id: randomUUID(),
  nombre: "PROMO",
  activo: true,
  precio: 13500,
  variantes: [],
  vigenteHasta: "2000-01-01",
};
assert.throws(
  () =>
    checkout.priceCheckout(
      { ...parsed, items: [{ itemId: vencida.id, variante: null, cantidad: 1 }] },
      [vencida],
    ),
  /dejó de estar disponible/,
);
const slides = promos.promoSlides([
  { ...vencida, destacado: true, imagenUrl: "/img/promo-cryspy-doble.jpg" },
  {
    ...vencida,
    id: randomUUID(),
    destacado: true,
    vigenteHasta: null,
    imagenUrl: "/img/promo-cryspy-doble.jpg",
  },
  { ...vencida, id: randomUUID(), destacado: false, vigenteHasta: null, imagenUrl: null },
]);
assert.equal(slides.length, 2); // solo la vigente, con sus dos piezas
assert.equal(slides[1].src, "/img/promo-cryspy-doble-2.jpg");
// Seguimiento del pedido: pasos y ventana de entrega.
const seguimiento = load("src/features/orders/seguimiento.ts");
const pedidoBase = {
  id: "x",
  num: 7,
  nombre: "Ana",
  tipo: "delivery",
  items: [{ nombre: "CRISPY", variante: "Doble", cantidad: 2, precio: 14500 }],
  costoEnvio: 1500,
  pago: "transferencia",
  demora: 30,
  creadoEn: "2026-10-31T21:47:00-03:00",
  horaConfirmado: "2026-10-31T21:50:00-03:00",
  horaEntregado: null,
  whatsapp: "543518737099",
};
// Pasos: enviado → en preparación → listo, saliendo → en camino (5 min después) → entregado.
const t0 = new Date("2026-10-31T22:10:00-03:00").getTime();
const pasosEn = (estado, tipo = "delivery", now = t0, horaListo = "2026-10-31T22:08:00-03:00") =>
  JSON.stringify(
    seguimiento
      .pasosSeguimiento({ ...pedidoBase, estado, tipo, horaListo }, now)
      .map((paso) => paso.estado[0]),
  );
assert.equal(pasosEn("nuevo"), JSON.stringify(["a", "p", "p", "p", "p"]));
assert.equal(pasosEn("en_cocina"), JSON.stringify(["h", "a", "p", "p", "p"]));
assert.equal(pasosEn("listo"), JSON.stringify(["h", "h", "a", "p", "p"]));
assert.equal(
  pasosEn("listo", "delivery", t0 + 3 * 60000),
  JSON.stringify(["h", "h", "h", "a", "p"]),
);
assert.equal(
  pasosEn("listo", "delivery", t0 + 60 * 60000, null),
  JSON.stringify(["h", "h", "a", "p", "p"]),
);
assert.equal(pasosEn("entregado"), JSON.stringify(["h", "h", "h", "h", "h"]));
// Retiro: sin "En camino".
assert.equal(pasosEn("listo", "takeaway", t0 + 60 * 60000), JSON.stringify(["h", "h", "a", "p"]));
assert.equal(
  JSON.stringify(seguimiento.ventanaEntrega({ ...pedidoBase, estado: "en_cocina" })),
  JSON.stringify({ desde: "22:20", hasta: "22:35" }),
);
assert.equal(seguimiento.ventanaEntrega({ ...pedidoBase, estado: "nuevo" }), null);
assert.equal(seguimiento.totalSeguimiento({ ...pedidoBase, estado: "nuevo" }), 30500);
assert.equal(seguimiento.esFinal("rechazado"), true);

// La pestaña "Promociones" se muestra dentro de Hamburguesas, primera.
const unidas = promos.unirPromosConHamburguesas([
  { categoria: "Promociones", items: [{ id: "promo" }] },
  { categoria: "Hamburguesas", items: [{ id: "cheese" }] },
  { categoria: "Extras", items: [{ id: "papas" }] },
]);
// JSON: los arrays vienen de otro contexto de vm y no comparten prototipo.
assert.equal(
  JSON.stringify(unidas.map((group) => [group.categoria, group.items.map((item) => item.id)])),
  JSON.stringify([
    ["Hamburguesas", ["promo", "cheese"]],
    ["Extras", ["papas"]],
  ]),
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
const carrusel = load("src/features/menu/carrusel.ts", { "./promos": promos });
// Carrusel gestionable: modo, días de promo y disponibilidad del día.
{
  const martes = new Date("2026-11-03T21:00:00-03:00");
  const lunes = new Date("2026-11-02T21:00:00-03:00");
  const madrugadaJueves = new Date("2026-11-06T02:00:00-03:00"); // sigue siendo jueves comercial
  assert.equal(carrusel.diaSemana(martes), 2);
  assert.equal(carrusel.diaSemana(madrugadaJueves), 4);
  const config = carrusel.carruselConfigFromJson({
    modo: "auto",
    diasPromo: [2, 3, 4, 9, "x"],
    promo: ["p2x"],
    normal: ["halloween"],
  });
  assert.equal(JSON.stringify(config.diasPromo), JSON.stringify([2, 3, 4]));
  assert.equal(carrusel.promoDelDiaActiva(config, martes), true);
  assert.equal(carrusel.promoDelDiaActiva(config, lunes), false);
  assert.equal(carrusel.promoDelDiaActiva({ ...config, modo: "promo" }, lunes), true);
  assert.equal(carrusel.promoDelDiaActiva({ ...config, modo: "normal" }, martes), false);
  assert.equal(carrusel.textoDias([4, 2, 3]), "Martes, miércoles y jueves");
  const base = {
    activo: true,
    destacado: false,
    vigenteHasta: null,
    variantes: [],
    imagenUrl: null,
  };
  const p2x = { ...base, id: "p2x", nombre: "PROMO 2 BURGERS" };
  const halloween = {
    ...base,
    id: "halloween",
    nombre: "CRYSPY DOBLE + BONIATOS",
    vigenteHasta: "2026-11-01",
    imagenUrl: "/img/promo-cryspy-doble.jpg",
  };
  const cheese = { ...base, id: "cheese", nombre: "CHEESEBURGER" };
  // La 2x solo se vende con la promo activa; la Halloween venció; el resto siempre.
  assert.equal(carrusel.disponibleHoy(p2x, config, martes), true);
  assert.equal(carrusel.disponibleHoy(p2x, config, lunes), false);
  assert.equal(carrusel.disponibleHoy(halloween, config, lunes), false);
  assert.equal(carrusel.disponibleHoy(cheese, config, lunes), true);
  const todos = [p2x, halloween, cheese];
  const slidesMartes = carrusel.slidesCarrusel(todos, config, martes);
  assert.equal(slidesMartes.length, 1);
  assert.equal(slidesMartes[0].item.id, "p2x");
  assert.equal(slidesMartes[0].disponible, true);
  assert.equal(slidesMartes[0].etiqueta, "Martes, miércoles y jueves");
  const slidesLunes = carrusel.slidesCarrusel(todos, config, lunes);
  assert.equal(slidesLunes.length, 2); // los dos flyers de Halloween
  assert.equal(
    slidesLunes.every((slide) => slide.item.id === "halloween" && !slide.disponible),
    true,
  );
}
const route = load("src/app/api/checkout/route.ts", {
  "@/features/menu/carrusel": carrusel,
  "@/services/supabase/admin": { createSupabaseAdminClient: () => db },
  "@/constants/business": { BUSINESS_SLUG: "clicks-burger" },
  "@/features/orders/checkout": checkout,
  "@/features/menu/mappers": { mapMenu: () => menu },
  "@/features/tenants/mappers": { mapTenant: (tenant) => tenant },
  "@/features/tenants/horarios": horarios,
  "@/features/envios/tarifas": tarifas,
  "@/features/envios/cotizar.server": { cotizarEnvio: async () => cotizacionEnvio },
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
    message.includes("A CONFIRMAR"),
);
assert.equal(checkout.readCheckout(rows[0].items).telefono, "3515550100");
// Seguimiento: el id del pedido es el requestId y el link viaja en el mensaje.
assert.equal(receipt.id, body.requestId);
assert.ok(message.includes(`Sigo mi pedido acá: http://localhost:3000/pedido/${body.requestId}`));
assert.equal((await route.POST(request({ ...body, nombre: "Otro cliente" }))).status, 409);
assert.equal(rows.length, 1);
assert.equal((await route.POST(request(body, "https://otra-web.example"))).status, 403);
assert.equal(
  (await route.POST(request({ ...body, requestId: randomUUID(), direccion: "" }))).status,
  400,
);
assert.equal(
  (await route.POST(request({ ...body, requestId: randomUUID(), expectedTotal: 1 }))).status,
  409,
  "Pide revisar la carta si cambió el total",
);
assert.equal(rows.length, 1, "No registra un pedido con un total no aceptado");
// Envío calculado por distancia: se suma al total y se guarda en el pedido.
cotizacionEnvio = {
  estado: "calculado",
  costo: 1500,
  km: 1.8,
  direccion: "Calle de prueba 123, Córdoba",
  lat: -31.39,
  lng: -64.21,
};
const conEnvio = { ...body, requestId: randomUUID(), expectedEnvio: 1500 };
const envioResponse = await route.POST(request(conEnvio));
assert.equal(envioResponse.status, 200);
const envioReceipt = await envioResponse.json();
assert.equal(envioReceipt.total, 9000, "Productos 7500 + envío 1500");
assert.equal(envioReceipt.costoEnvio, 1500);
assert.equal(rows.at(-1).costo_envio, 1500);
assert.equal(checkout.readCheckout(rows.at(-1).items).envio.km, 1.8);
assert.ok(
  new URL(envioReceipt.whatsappUrl).searchParams.get("text").includes("Total a pagar: $ 9.000") ||
    new URL(envioReceipt.whatsappUrl).searchParams
      .get("text")
      .includes("Total a pagar: $\u00a09.000"),
);
// Reintento del mismo pedido: devuelve el mismo total con envío.
assert.equal((await (await route.POST(request(conEnvio))).json()).total, 9000);
// Si el cliente vio otro costo de envío, no se guarda y se le devuelve el nuevo.
const desactualizado = await route.POST(
  request({ ...body, requestId: randomUUID(), expectedEnvio: 1000 }),
);
assert.equal(desactualizado.status, 409);
assert.equal((await desactualizado.json()).envio.costo, 1500);
const filasConEnvio = rows.length;
cotizacionEnvio = tarifas.aConfirmar("no_disponible");
assert.equal(rows.length, filasConEnvio);
const other = { ...body, requestId: randomUUID(), tipo: "takeaway", direccion: "" };
assert.equal((await route.POST(request(other))).status, 200);
assert.equal(rows.length, filasConEnvio + 1);
closed = true;
assert.equal((await route.POST(request({ ...body, requestId: randomUUID() }))).status, 409);
assert.equal(
  (await route.POST(request(body))).status,
  200,
  "Recupera pedidos existentes aun con el local cerrado",
);
assert.equal(rows.length, filasConEnvio + 1);
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
