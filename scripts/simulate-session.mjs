#!/usr/bin/env node
/**
 * Simulación de una sesión completa de Clicks, de la apertura al cierre de caja.
 *
 * Usa los mismos caminos que la app real:
 *  - Los pedidos entran por POST /api/checkout (igual que un cliente desde el celular).
 *  - Caja confirma, edita, rechaza, marca listo y entrega con una sesión real de
 *    staff y las mismas reglas de estado de src/features/orders/transitions.ts.
 *  - Escucha Realtime como lo hacen las pantallas de caja y cocina.
 *  - Abre y cierra la caja con las funciones de la base (caja_ventas / cerrar_caja).
 *
 * Todo lo que crea queda marcado "PRUEBA <id>" y se registra en .qa-session/<id>.json.
 * Al terminar lo borra (salvo --conservar), así el local arranca desde cero.
 *
 * Uso (desde clicks-next):
 *   node scripts/simulate-session.mjs --url https://tu-app.vercel.app
 *       → solo verificaciones de lectura; no escribe nada.
 *   node scripts/simulate-session.mjs --url https://tu-app.vercel.app --confirmar
 *       → corre la sesión completa y limpia al final.
 *   Opciones: --pedidos 18  --rafaga 6  --ritmo 400  --conservar
 *   node scripts/simulate-session.mjs --limpiar <id>
 *       → borra lo que dejó una corrida anterior.
 *
 * Credenciales (variables de entorno; el script no las guarda):
 *   CLICKS_TEST_EMAIL, CLICKS_TEST_PASSWORD      usuario admin o cajero (admin para poder borrar el turno)
 *   CLICKS_COCINA_EMAIL, CLICKS_COCINA_PASSWORD  opcional: verifica que cocina no pueda modificar
 * Supabase URL y anon key se leen de .env.local si no están en el entorno.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const SLUG = "clicks-burger";
const RUN_DIR = path.join(ROOT, ".qa-session");

// ── Utilidades ───────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (n) => `$ ${Math.round(n).toLocaleString("es-AR")}`;
const pct = (list, p) => {
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

const results = [];
/** Limpieza de emergencia de la sesión en curso (se define al abrir la caja). */
let onFatal = null;
function record(status, step, detail = "") {
  results.push({ status, step, detail });
  const icon = { ok: "✔", fail: "✖", warn: "⚠", info: "·" }[status];
  console.log(`  ${icon} ${step}${detail ? ` — ${detail}` : ""}`);
}
const ok = (step, detail) => record("ok", step, detail);
const fail = (step, detail) => record("fail", step, detail);
const warn = (step, detail) => record("warn", step, detail);
const info = (step, detail) => record("info", step, detail);
const check = (cond, step, detail, failDetail = detail) =>
  cond ? ok(step, detail) : fail(step, failDetail);
const section = (title) => console.log(`\n${title}`);

function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

/** Carga un módulo TypeScript del proyecto para reutilizar la lógica real de la app. */
const tsCache = new Map();
function loadTs(rel) {
  if (tsCache.has(rel)) return tsCache.get(rel);
  const source = fs.readFileSync(path.join(ROOT, "src", rel), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  const localRequire = (id) => (id.startsWith("@/") ? loadTs(`${id.slice(2)}.ts`) : require(id));
  vm.runInThisContext(`(function (exports, require) {${outputText}\n})`)(exports, localRequire);
  tsCache.set(rel, exports);
  return exports;
}

/** Generador pseudoaleatorio con semilla: la misma corrida se puede repetir. */
function rng(seedText) {
  let seed = [...seedText].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const next = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

function saveRun(run) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(path.join(RUN_DIR, `${run.id}.json`), JSON.stringify(run, null, 2));
}

/**
 * Si Realtime no puede conectarse, `ws` emite un "error" sin escuchar y mata el
 * proceso (dejando la caja de prueba abierta). Con este listener se reporta como
 * falla de la verificación de tiempo real y la sesión sigue.
 */
class SafeWebSocket extends WebSocket {
  constructor(...params) {
    super(...params);
    this.on("error", () => {});
  }
}

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local).");
    process.exit(2);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: true },
    realtime: { transport: SafeWebSocket },
  });
}

async function signIn(client, emailVar, passVar, label) {
  const email = process.env[emailVar];
  const password = process.env[passVar];
  if (!email || !password) return null;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    fail(`Login ${label}`, error.message);
    return null;
  }
  return data.user;
}

// ── Catálogo y armado de pedidos ─────────────────────────────
function buildMenu(items, variants, categories) {
  const { mapMenu } = loadTs("features/menu/mappers.ts");
  return mapMenu(items, variants, categories).filter((item) => item.activo);
}

/** Mismo cálculo que priceCheckout en el servidor. */
function lineTotal(product, variante, cantidad) {
  if (!product.variantes.length) return (product.precio ?? 0) * cantidad;
  const first = product.variantes.find((v) => v.label === variante.split(" + ")[0]);
  return first.precio * cantidad;
}

function classify(menu) {
  const isDip = (p) => p.nombre.trim().toUpperCase() === "DIP DE SALSAS";
  const priced = (p) => p.variantes.length > 0 || (p.precio != null && p.precio >= 0);
  const valid = menu.filter(priced);
  const byCat = (text) =>
    valid.filter((p) => !isDip(p) && p.categoria.toLowerCase().includes(text));
  return {
    burgers: byCat("hamburg").filter((p) => p.variantes.length),
    extras: byCat("extra").filter((p) => !p.variantes.length),
    drinks: byCat("bebida").filter((p) => !p.variantes.length),
    dip: valid.find(isDip),
    any: valid.filter((p) => !isDip(p)),
  };
}

function makeOrder(r, catalog, runId, index) {
  const lines = [];
  const add = (product, variante = null, cantidad = 1, obs) => {
    if (!product) return;
    lines.push({ product, variante, cantidad, obs });
  };
  const burgers = catalog.burgers.length ? catalog.burgers : catalog.any;
  for (let i = 0, n = r.int(1, 3); i < n; i++) {
    const burger = r.pick(burgers);
    const variante = burger.variantes.length ? r.pick(burger.variantes).label : null;
    const obs = r.chance(0.35)
      ? r.pick(["sin cebolla", "bien cocida", "sin pepino", "extra salsa", "cortada al medio"])
      : undefined;
    add(burger, variante, r.int(1, 2), obs);
  }
  if (catalog.extras.length && r.chance(0.6)) add(r.pick(catalog.extras), null, r.int(1, 2));
  if (catalog.dip && r.chance(0.45)) {
    const labels = [...catalog.dip.variantes].sort(() => r.next() - 0.5).slice(0, r.int(1, 3));
    const ordered = catalog.dip.variantes.filter((v) => labels.includes(v)).map((v) => v.label);
    if (ordered.length) add(catalog.dip, ordered.join(" + "), 1);
  }
  if (catalog.drinks.length && r.chance(0.7)) add(r.pick(catalog.drinks), null, r.int(1, 3));
  const tipo = r.chance(0.5) ? "delivery" : "takeaway";
  const payload = {
    requestId: randomUUID(),
    nombre: `PRUEBA ${runId} cliente ${String(index + 1).padStart(2, "0")}`,
    telefono: `351000${String(1000 + index)}`,
    tipo,
    direccion: tipo === "delivery" ? `Calle de prueba ${100 + index}` : "",
    referencia: tipo === "delivery" && r.chance(0.5) ? "Timbre B" : "",
    pago: r.chance(0.6) ? "efectivo" : "transferencia",
    items: lines.map((l) => ({
      itemId: l.product.id,
      variante: l.variante,
      cantidad: l.cantidad,
      ...(l.obs ? { obs: l.obs } : {}),
    })),
    expectedTotal: lines.reduce((s, l) => s + lineTotal(l.product, l.variante, l.cantidad), 0),
  };
  return payload;
}

async function postCheckout(baseUrl, payload) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${baseUrl}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { status: 0, body: { error: error.message }, ms: performance.now() - started };
  }
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, ms: performance.now() - started };
}

// ── Limpieza ─────────────────────────────────────────────────
async function cleanup(client, run, isAdmin) {
  section("Limpieza");
  const ids = run.pedidoIds;
  if (ids.length) {
    const { error } = await client.from("pedidos").delete().in("id", ids);
    if (error) fail("Borrar pedidos de prueba", error.message);
    const { data: left } = await client.from("pedidos").select("id").in("id", ids);
    check(
      !left?.length,
      "Pedidos de prueba borrados",
      `${ids.length} registrados`,
      `quedan ${left?.length}`,
    );
  }
  if (run.turnoId) {
    if (!isAdmin) {
      warn(
        "Turno de caja de prueba",
        `solo un admin puede borrarlo. Corré --limpiar ${run.id} con un usuario admin.`,
      );
      return false;
    }
    const { error } = await client.from("caja_turnos").delete().eq("id", run.turnoId);
    if (error) fail("Borrar turno de prueba", error.message);
    else ok("Turno de caja de prueba borrado");
  }
  run.limpio = true;
  saveRun(run);
  return true;
}

// ── Programa principal ───────────────────────────────────────
async function main() {
  loadEnvFile();
  const baseUrl = (opt("url", process.env.CLICKS_BASE_URL) ?? "").replace(/\/$/, "");
  const confirm = flag("confirmar");
  const limpiarId = opt("limpiar");
  const total = Math.max(4, Number(opt("pedidos", 18)));
  const burst = Math.max(2, Math.min(total - 2, Number(opt("rafaga", 6))));
  const pace = Math.max(0, Number(opt("ritmo", 400)));

  const staff = makeClient();
  if (!process.env.CLICKS_TEST_EMAIL || !process.env.CLICKS_TEST_PASSWORD) {
    console.error("Definí CLICKS_TEST_EMAIL y CLICKS_TEST_PASSWORD (usuario admin o cajero).");
    process.exit(2);
  }

  // Modo limpieza de una corrida anterior.
  if (limpiarId) {
    const file = path.join(RUN_DIR, `${limpiarId}.json`);
    if (!fs.existsSync(file)) {
      console.error(`No existe ${file}`);
      process.exit(2);
    }
    const run = JSON.parse(fs.readFileSync(file, "utf8"));
    const user = await signIn(staff, "CLICKS_TEST_EMAIL", "CLICKS_TEST_PASSWORD", "staff");
    if (!user) process.exit(1);
    const { data: m } = await staff
      .from("memberships")
      .select("rol")
      .eq("user_id", user.id)
      .eq("tenant_id", run.tenantId)
      .maybeSingle();
    await cleanup(staff, run, m?.rol === "admin");
    process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
  }

  if (!baseUrl) {
    console.error(
      "Indicá la URL de la app: --url https://tu-app.vercel.app (o http://localhost:3000).",
    );
    process.exit(2);
  }

  const runId = `T${new Date().toISOString().replace(/\D/g, "").slice(2, 12)}`;
  console.log(`Clicks · sesión simulada ${runId} contra ${baseUrl}`);
  console.log(
    confirm
      ? "Modo: sesión completa (escribe y limpia)."
      : "Modo: solo lectura (agregá --confirmar para la sesión completa).",
  );

  // 1. Páginas públicas y protección de staff.
  section("1. Páginas");
  for (const [label, route, expect] of [
    ["Inicio", "/", [200, 307, 308]],
    ["Carta", `/t/${SLUG}/menu`, [200]],
    ["Ingreso del equipo", `/t/${SLUG}/login`, [200]],
  ]) {
    const started = performance.now();
    try {
      const res = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
      const ms = Math.round(performance.now() - started);
      check(
        expect.includes(res.status),
        label,
        `${res.status} en ${ms} ms`,
        `respondió ${res.status}`,
      );
      if (ms > 3000)
        warn(label, `tardó ${ms} ms (primera carga en frío de Vercel puede ser lenta)`);
    } catch (error) {
      fail(label, `no responde: ${error.message}`);
    }
  }
  try {
    const res = await fetch(`${baseUrl}/t/${SLUG}/caja`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    check(
      [307, 308].includes(res.status) && location.includes("/login"),
      "Caja exige ingreso",
      "sin sesión redirige al login",
      `respondió ${res.status} ${location}`,
    );
  } catch (error) {
    fail("Caja exige ingreso", error.message);
  }

  // 2. Local, carta y horario.
  section("2. Local y carta");
  const { data: tenant, error: tenantError } = await staff
    .from("tenants")
    .select("id,nombre,slug,activo,horarios")
    .eq("slug", SLUG)
    .maybeSingle();
  if (tenantError || !tenant) {
    fail("Local", tenantError?.message ?? `no existe el slug ${SLUG}`);
    return finish();
  }
  check(
    tenant.activo,
    "Local activo",
    tenant.nombre,
    "el local está inactivo: el checkout lo rechaza",
  );
  const [items, variants, categories] = await Promise.all([
    staff.from("menu_items").select("*").eq("tenant_id", tenant.id),
    staff.from("menu_variants").select("*").eq("tenant_id", tenant.id).order("orden"),
    staff.from("categorias").select("*").eq("tenant_id", tenant.id),
  ]);
  if (items.error || variants.error || categories.error) {
    fail("Carta", (items.error ?? variants.error ?? categories.error).message);
    return finish();
  }
  const menu = buildMenu(items.data, variants.data, categories.data);
  const catalog = classify(menu);
  check(
    menu.length > 0,
    "Carta publicada",
    `${menu.length} productos activos`,
    "no hay productos activos",
  );
  if (!catalog.burgers.length) warn("Hamburguesas", "no se encontraron hamburguesas con variantes");
  const noPhoto = menu.filter((p) => !p.imagenUrl).map((p) => p.nombre);
  if (noPhoto.length) info("Sin foto", noPhoto.join(", "));
  const { estaAbierto, horariosFromJson } = loadTs("features/tenants/horarios.ts");
  const abierto = estaAbierto(tenant.horarios == null ? null : horariosFromJson(tenant.horarios));
  check(
    abierto,
    "Horario de atención",
    "el local figura abierto",
    "el local figura CERRADO ahora: el checkout rechaza pedidos. Ajustá el horario en Configuración o corré en horario.",
  );

  // 3. Sesión del equipo.
  section("3. Equipo");
  const user = await signIn(staff, "CLICKS_TEST_EMAIL", "CLICKS_TEST_PASSWORD", "staff");
  if (!user) return finish();
  const { data: membership } = await staff
    .from("memberships")
    .select("rol")
    .eq("user_id", user.id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  const rol = membership?.rol;
  check(
    ["admin", "cajero"].includes(rol),
    "Rol del usuario de prueba",
    rol,
    `rol ${rol ?? "sin membresía"}: hace falta admin o cajero`,
  );
  const isAdmin = rol === "admin";
  const { data: abierta } = await staff
    .from("caja_turnos")
    .select("id,abierto_en,abierto_por_email")
    .eq("tenant_id", tenant.id)
    .is("cerrado_en", null)
    .maybeSingle();
  check(
    !abierta,
    "Caja sin turno abierto",
    "se puede abrir una caja de prueba",
    `ya hay una caja abierta desde ${abierta?.abierto_en} (${abierta?.abierto_por_email ?? "?"}). No se toca: cerrala antes.`,
  );
  const { data: activos } = await staff
    .from("pedidos")
    .select("num,estado")
    .eq("tenant_id", tenant.id)
    .in("estado", ["nuevo", "en_cocina", "listo"]);
  if (activos?.length)
    warn(
      "Pedidos activos existentes",
      `${activos.length} pedidos reales en curso; se dejan intactos`,
    );

  if (!confirm || results.some((r) => r.status === "fail")) {
    if (!confirm) info("Fin del modo lectura", "agregá --confirmar para correr la sesión completa");
    return finish();
  }

  // ── Sesión completa ─────────────────────────────────────────
  const { checkoutSchema, attachCheckout } = loadTs("features/orders/checkout.ts");
  const { transicion } = loadTs("features/orders/transitions.ts");
  const r = rng(runId);
  const run = {
    id: runId,
    url: baseUrl,
    tenantId: tenant.id,
    pedidoIds: [],
    turnoId: null,
    creado: new Date().toISOString(),
  };
  saveRun(run);
  // Red de seguridad: ante cualquier error inesperado se intenta limpiar igual.
  let rescuing = false;
  const rescue = async (error) => {
    if (rescuing) return;
    rescuing = true;
    console.error("\nError inesperado durante la sesión:", error?.message ?? error);
    if (!flag("conservar")) await cleanup(staff, run, isAdmin).catch(() => {});
    console.error(`Si quedó algo, corré: node scripts/simulate-session.mjs --limpiar ${run.id}`);
    process.exit(1);
  };
  onFatal = rescue;
  process.on("uncaughtException", rescue);
  process.on("unhandledRejection", rescue);
  const montoInicial = 20000;

  // 4. Apertura de caja.
  section("4. Apertura de caja");
  const { data: turno, error: turnoError } = await staff
    .from("caja_turnos")
    .insert({
      tenant_id: tenant.id,
      abierto_por: user.id,
      abierto_por_email: user.email,
      monto_inicial: montoInicial,
      nota_apertura: `PRUEBA AUTOMATICA ${runId}`,
    })
    .select("*")
    .single();
  if (turnoError) {
    fail("Abrir caja", turnoError.message);
    return finish(run, staff, isAdmin);
  }
  run.turnoId = turno.id;
  saveRun(run);
  ok("Caja abierta", `fondo inicial ${money(montoInicial)}`);
  const { data: dup, error: dupError } = await staff
    .from("caja_turnos")
    .insert({
      tenant_id: tenant.id,
      abierto_por: user.id,
      monto_inicial: 0,
      nota_apertura: `PRUEBA duplicada ${runId}`,
    })
    .select("id")
    .maybeSingle();
  if (dup?.id) {
    // No debería pasar; si pasa, se borra para no dejar una caja colgada.
    await staff.from("caja_turnos").delete().eq("id", dup.id);
  }
  check(
    dupError?.code === "23505",
    "No permite dos cajas abiertas",
    "segundo turno rechazado",
    `respuesta inesperada: ${dupError?.message ?? "se abrió otra caja"}`,
  );

  // 5. Tiempo real (como las pantallas de caja y cocina).
  section("5. Tiempo real");
  const events = { insert: new Map(), update: 0, delete: 0 };
  const channel = staff
    .channel(`qa:${runId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pedidos", filter: `tenant_id=eq.${tenant.id}` },
      (payload) => {
        if (payload.eventType === "INSERT") events.insert.set(payload.new.id, performance.now());
        else if (payload.eventType === "UPDATE") events.update++;
        else events.delete++;
      },
    );
  const subscribed = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 12000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
  check(
    subscribed,
    "Suscripción Realtime",
    "conectada",
    "no se conectó en 12 s: caja y cocina no se actualizarían solas",
  );

  // 6. Pedidos de clientes.
  section(`6. Pedidos de clientes (${total}, ${burst} en simultáneo)`);
  const orders = Array.from({ length: total }, (_, i) => makeOrder(r, catalog, runId, i));
  for (const order of orders) {
    const parsed = checkoutSchema.safeParse(order);
    if (!parsed.success) fail("Pedido generado inválido", parsed.error.issues[0]?.message);
  }
  const created = [];
  const checkoutMs = [];
  const sentAt = new Map();
  const send = async (order) => {
    sentAt.set(order.requestId, performance.now());
    const res = await postCheckout(baseUrl, order);
    checkoutMs.push(res.ms);
    if (res.status === 200) {
      run.pedidoIds.push(order.requestId);
      saveRun(run);
      created.push({ ...order, num: res.body.num, total: res.body.total });
      if (Math.abs(res.body.total - order.expectedTotal) > 0.005)
        fail(
          `Total del pedido #${res.body.num}`,
          `servidor ${money(res.body.total)} vs carrito ${money(order.expectedTotal)}`,
        );
      if (!String(res.body.whatsappUrl ?? "").startsWith("https://wa.me/"))
        fail(`WhatsApp del pedido #${res.body.num}`, "no devolvió el enlace");
    } else {
      fail(`Checkout de ${order.nombre}`, `${res.status}: ${res.body.error ?? "sin detalle"}`);
    }
  };
  const sequential = orders.slice(0, total - burst);
  for (const order of sequential) {
    await send(order);
    await sleep(pace);
  }
  await Promise.all(orders.slice(total - burst).map(send));
  check(
    created.length === total,
    "Pedidos registrados",
    `${created.length}/${total}`,
    `${created.length}/${total}`,
  );
  const nums = created.map((o) => o.num);
  check(
    new Set(nums).size === nums.length,
    "Numeración sin repetidos",
    `#${Math.min(...nums)} a #${Math.max(...nums)}`,
    `números repetidos: ${nums.join(", ")}`,
  );
  ok(
    "Tiempo de checkout",
    `mediana ${Math.round(pct(checkoutMs, 50))} ms · p95 ${Math.round(pct(checkoutMs, 95))} ms · máx ${Math.round(Math.max(...checkoutMs))} ms`,
  );

  if (created.length) {
    const first = orders.find((o) => o.requestId === created[0].requestId);
    const again = await postCheckout(baseUrl, first);
    check(
      again.status === 200 && again.body.num === created[0].num,
      "Reintento no duplica",
      `mismo #${created[0].num}`,
      `${again.status} ${again.body.error ?? again.body.num}`,
    );
    const changed = await postCheckout(baseUrl, { ...first, nombre: `${first.nombre} cambiado` });
    check(
      changed.status === 409,
      "Reintento con otros datos se rechaza",
      "409",
      `${changed.status}`,
    );
  }
  const tampered = { ...makeOrder(r, catalog, runId, total), expectedTotal: 1 };
  const tamperedRes = await postCheckout(baseUrl, tampered);
  check(tamperedRes.status === 409, "Precio adulterado se rechaza", "409", `${tamperedRes.status}`);
  if (tamperedRes.status === 200) run.pedidoIds.push(tampered.requestId);

  // 7. Lo que ve caja.
  section("7. Caja recibe los pedidos");
  const { data: rows, error: rowsError } = await staff
    .from("pedidos")
    .select("*")
    .in("id", run.pedidoIds);
  if (rowsError) fail("Leer pedidos como staff", rowsError.message);
  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  let mismatches = 0;
  for (const order of created) {
    const row = byId.get(order.requestId);
    if (!row) {
      mismatches++;
      fail(`Pedido #${order.num} visible para caja`, "no aparece");
      continue;
    }
    const sum = row.items.reduce((s, it) => s + it.precio * it.cantidad, 0);
    if (
      row.estado !== "nuevo" ||
      Math.abs(sum - order.total) > 0.005 ||
      row.items[0]?.checkout?.version !== 1
    ) {
      mismatches++;
      fail(
        `Pedido #${order.num}`,
        `estado ${row.estado}, total ${money(sum)}, datos de entrega ${row.items[0]?.checkout ? "ok" : "faltan"}`,
      );
    }
  }
  check(
    !mismatches,
    "Pedidos completos en caja",
    "estado, totales, contacto y pago correctos",
    `${mismatches} con diferencias`,
  );
  const waitUntil = performance.now() + 8000;
  while (
    subscribed &&
    performance.now() < waitUntil &&
    created.some((o) => !events.insert.has(o.requestId))
  )
    await sleep(250);
  if (subscribed) {
    const lags = created
      .filter((o) => events.insert.has(o.requestId))
      .map((o) => events.insert.get(o.requestId) - sentAt.get(o.requestId));
    const missing = created.filter((o) => !events.insert.has(o.requestId)).map((o) => `#${o.num}`);
    check(
      !missing.length,
      "Avisos en tiempo real",
      `${created.length} recibidos · demora máx ${Math.round(Math.max(0, ...lags))} ms desde el envío`,
      `faltaron ${missing.join(", ")}`,
    );
  }

  // 8. Cocina solo lectura.
  section("8. Permisos de cocina");
  if (process.env.CLICKS_COCINA_EMAIL) {
    const kitchen = makeClient();
    const cook = await signIn(kitchen, "CLICKS_COCINA_EMAIL", "CLICKS_COCINA_PASSWORD", "cocina");
    if (cook && created.length) {
      const { data: seen } = await kitchen.from("pedidos").select("id").in("id", run.pedidoIds);
      check(
        seen?.length === created.length,
        "Cocina ve los pedidos",
        `${seen?.length}`,
        `ve ${seen?.length ?? 0} de ${created.length}`,
      );
      const { data: changedRows } = await kitchen
        .from("pedidos")
        .update({ estado: "listo" })
        .eq("id", created[0].requestId)
        .select("id");
      check(
        !changedRows?.length,
        "Cocina no puede cambiar estados",
        "bloqueado por permisos",
        "¡cocina pudo modificar un pedido!",
      );
      const { error: cajaErr } = await kitchen.from("caja_turnos").select("id").limit(1);
      const { data: cajaRows } = await kitchen.from("caja_turnos").select("id").eq("id", turno.id);
      check(
        cajaErr || !cajaRows?.length,
        "Cocina no ve la caja",
        "bloqueado por permisos",
        "cocina puede leer los turnos de caja",
      );
      await kitchen.auth.signOut();
    }
  } else info("Cocina", "sin CLICKS_COCINA_EMAIL: se omite la verificación de permisos");

  // 9. Operación de caja durante el turno.
  section("9. Despacho");
  const opMs = [];
  const timed = async (label, fn) => {
    const started = performance.now();
    const { data, error } = await fn();
    opMs.push(performance.now() - started);
    if (error) fail(label, error.message);
    else if (Array.isArray(data) && !data.length) fail(label, "no se aplicó (0 filas)");
    return !error;
  };
  const queue = [...created].sort((a, b) => a.num - b.num);
  // Un rechazado, un editado, uno que queda "listo" sin entregar y uno reabierto.
  const rejected = queue.length >= 4 ? queue[1] : undefined;
  const live = queue.filter((o) => o !== rejected);
  const edited = live.length >= 3 ? live[1] : undefined;
  const keepReady = live.length >= 2 ? live[live.length - 1] : undefined;
  if (rejected) {
    // "Rechazar" en caja elimina el pedido.
    await timed(`Rechazar #${rejected.num}`, () =>
      staff.from("pedidos").delete().eq("id", rejected.requestId).select("id"),
    );
    ok(`Pedido #${rejected.num} rechazado`);
  }
  if (edited) {
    const row = byId.get(edited.requestId);
    const editedItems = row.items.map(({ checkout, ...it }, i) =>
      i === 0 ? { ...it, obs: "EDITADO EN CAJA" } : it,
    );
    await timed(`Editar #${edited.num}`, () =>
      staff
        .from("pedidos")
        .update({
          nombre: `${edited.nombre} (editado)`,
          items: attachCheckout(editedItems, row.items[0].checkout),
        })
        .eq("id", edited.requestId)
        .select("id"),
    );
    const { data: after } = await staff
      .from("pedidos")
      .select("items,nombre")
      .eq("id", edited.requestId)
      .single();
    check(
      after?.items?.[0]?.obs === "EDITADO EN CAJA" && after.items[0].checkout?.version === 1,
      `Edición de #${edited.num}`,
      "conserva datos de entrega",
      "se perdieron datos al editar",
    );
  }
  for (const order of live) {
    await timed(`Confirmar #${order.num}`, () =>
      staff
        .from("pedidos")
        .update(transicion("nuevo", "en_cocina", { demora: r.pick([10, 15, 20, 25]) }))
        .eq("id", order.requestId)
        .select("id"),
    );
  }
  for (const order of live) {
    await timed(`Listo #${order.num}`, () =>
      staff
        .from("pedidos")
        .update(transicion("en_cocina", "listo"))
        .eq("id", order.requestId)
        .select("id"),
    );
  }
  const reopened = live[0];
  if (reopened) {
    await timed(`Reabrir #${reopened.num}`, () =>
      staff
        .from("pedidos")
        .update(transicion("listo", "en_cocina"))
        .eq("id", reopened.requestId)
        .select("id"),
    );
    await timed(`Listo otra vez #${reopened.num}`, () =>
      staff
        .from("pedidos")
        .update(transicion("en_cocina", "listo"))
        .eq("id", reopened.requestId)
        .select("id"),
    );
  }
  const delivered = live.filter((o) => o !== keepReady);
  for (const order of delivered) {
    await timed(`Entregar #${order.num}`, () =>
      staff
        .from("pedidos")
        .update(transicion("listo", "entregado"))
        .eq("id", order.requestId)
        .select("id"),
    );
  }
  let invalidBlocked = false;
  try {
    transicion("entregado", "nuevo");
  } catch {
    invalidBlocked = true;
  }
  check(invalidBlocked, "Transición inválida bloqueada", "entregado → nuevo");
  ok(
    "Tiempo de cada acción de caja",
    `mediana ${Math.round(pct(opMs, 50))} ms · p95 ${Math.round(pct(opMs, 95))} ms`,
  );
  const { data: finalRows } = await staff
    .from("pedidos")
    .select("id,estado,hora_confirmado,hora_entregado,demora")
    .in("id", run.pedidoIds);
  const wrongState = (finalRows ?? []).filter((row) => {
    const expected = row.id === keepReady?.requestId ? "listo" : "entregado";
    return (
      row.estado !== expected ||
      !row.hora_confirmado ||
      row.demora == null ||
      (expected === "entregado" && !row.hora_entregado)
    );
  });
  check(
    !wrongState.length && finalRows?.length === live.length,
    "Estados y horarios finales",
    `${delivered.length} entregados, ${keepReady ? 1 : 0} listo, ${rejected ? 1 : 0} rechazado`,
    `${wrongState.length} pedidos con estado u hora incorrectos`,
  );
  if (subscribed) {
    await sleep(1500);
    const expectedUpdates =
      (edited ? 1 : 0) + live.length * 2 + (reopened ? 2 : 0) + delivered.length;
    check(
      events.update >= expectedUpdates && events.delete >= (rejected ? 1 : 0),
      "Cambios en tiempo real",
      `${events.update} actualizaciones · ${events.delete} bajas`,
      `llegaron ${events.update}/${expectedUpdates} actualizaciones y ${events.delete} bajas`,
    );
  }

  // 10. Cierre de caja.
  section("10. Cierre de caja");
  const expectedVentas = delivered.reduce((s, o) => s + o.total, 0);
  const { data: ventas, error: ventasError } = await staff.rpc("caja_ventas", {
    p_tenant_id: tenant.id,
    p_desde: turno.abierto_en,
  });
  if (ventasError) fail("Ventas del turno", ventasError.message);
  const v = ventas?.[0] ?? { total: 0, cantidad: 0 };
  const ventasOk =
    Math.abs(Number(v.total) - expectedVentas) < 0.01 && Number(v.cantidad) === delivered.length;
  check(
    ventasOk,
    "Ventas antes del cierre",
    `${money(v.total)} en ${v.cantidad} pedidos (el listo no cuenta)`,
    `base ${money(v.total)}/${v.cantidad} vs esperado ${money(expectedVentas)}/${delivered.length}${activos?.length ? " — puede haber pedidos reales entregados en el turno" : ""}`,
  );
  const faltante = 500;
  const montoFinal = montoInicial + expectedVentas - faltante;
  const { data: cerrado, error: cierreError } = await staff.rpc("cerrar_caja", {
    p_turno_id: turno.id,
    p_monto_final: montoFinal,
    p_nota: `PRUEBA AUTOMATICA ${runId}`,
  });
  if (cierreError) fail("Cerrar caja", cierreError.message);
  else {
    check(
      Math.abs(Number(cerrado.ventas) - expectedVentas) < 0.01,
      "Cierre: ventas",
      money(cerrado.ventas),
    );
    check(
      Number(cerrado.pedidos_count) === delivered.length,
      "Cierre: pedidos",
      String(cerrado.pedidos_count),
    );
    check(
      Math.abs(Number(cerrado.diferencia) + faltante) < 0.01,
      "Cierre: diferencia",
      `${money(cerrado.diferencia)} (se simuló un faltante de ${money(faltante)})`,
      `diferencia ${money(cerrado.diferencia)}, esperada -${money(faltante)}`,
    );
  }
  const { error: twiceError } = await staff.rpc("cerrar_caja", {
    p_turno_id: turno.id,
    p_monto_final: montoFinal,
  });
  check(Boolean(twiceError), "No permite cerrar dos veces", "rechazado");

  if (subscribed) await staff.removeChannel(channel);
  return finish(run, staff, isAdmin);

  async function finish(runData, client, admin) {
    if (runData && client) {
      if (flag("conservar")) {
        section("Datos conservados");
        info("Para borrarlos", `node scripts/simulate-session.mjs --limpiar ${runData.id}`);
      } else await cleanup(client, runData, admin);
    }
    const fails = results.filter((x) => x.status === "fail").length;
    const warns = results.filter((x) => x.status === "warn").length;
    console.log(
      `\nResultado: ${fails ? `✖ ${fails} fallas` : "✔ sin fallas"}${warns ? ` · ⚠ ${warns} avisos` : ""}`,
    );
    if (runData) {
      runData.resultados = results;
      saveRun(runData);
      console.log(`Detalle: .qa-session/${runData.id}.json`);
    }
    await staff.auth.signOut().catch(() => {});
    process.exit(fails ? 1 : 0);
  }
}

export { buildMenu, classify, makeOrder, lineTotal, loadTs, rng };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    if (onFatal) return onFatal(error);
    console.error("\nError inesperado:", error);
    console.error("Si la sesión llegó a escribir datos, revisá .qa-session/ y usá --limpiar <id>.");
    process.exit(1);
  });
}
