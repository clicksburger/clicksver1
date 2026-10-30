#!/usr/bin/env node
/**
 * Crea (o actualiza) un usuario del equipo de Clicks y le asigna su rol.
 *
 * Uso, desde clicks-next:
 *   node scripts/crear-usuario.mjs
 * Pregunta email, contraseña y rol (admin / cajero / cocina).
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY de .env.local: corré esto solo en tu PC.
 * La contraseña no se guarda ni se muestra.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "clicks-burger";
const ROLES = ["admin", "cajero", "cocina"];

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
// Cola de líneas: funciona tanto tipeando como con la entrada redirigida.
const lines = [];
const waiting = [];
let muted = false;
const writeOriginal = rl._writeToOutput.bind(rl);
rl._writeToOutput = (text) => {
  if (!muted) writeOriginal(text);
};
rl.on("line", (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
rl.on("close", () => waiting.splice(0).forEach((resolve) => resolve("")));
const nextLine = () =>
  new Promise((resolve) => (lines.length ? resolve(lines.shift()) : waiting.push(resolve)));
async function ask(question) {
  process.stdout.write(question);
  return (await nextLine()).trim();
}
/** Pregunta sin mostrar lo que se escribe. */
async function askHidden(question) {
  process.stdout.write(question);
  muted = true;
  const answer = await nextLine();
  muted = false;
  process.stdout.write("\n");
  return answer;
}

const email = (await ask("Email: ")).toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Email inválido.");
  process.exit(1);
}
const password = await askHidden("Contraseña (mínimo 8 caracteres, no se ve al escribir): ");
const repeat = await askHidden("Repetila: ");
if (password.length < 8 || password !== repeat) {
  console.error(
    password !== repeat ? "Las contraseñas no coinciden." : "La contraseña es muy corta.",
  );
  process.exit(1);
}
const rol = (await ask("Rol (admin / cajero / cocina): ")).toLowerCase();
rl.close();
if (!ROLES.includes(rol)) {
  console.error(`Rol inválido. Opciones: ${ROLES.join(", ")}`);
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: tenant, error: tenantError } = await db
  .from("tenants")
  .select("id,nombre")
  .eq("slug", SLUG)
  .single();
if (tenantError || !tenant) {
  console.error(`No se encontró el local ${SLUG}: ${tenantError?.message ?? ""}`);
  process.exit(1);
}

// ¿Ya existe el usuario? (se recorre la lista de Auth; el equipo es chico)
let user = null;
for (let page = 1; page < 50 && !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error(`No se pudo consultar Auth: ${error.message}`);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 200) break;
}

if (user) {
  const { error } = await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) {
    console.error(`No se pudo actualizar la contraseña: ${error.message}`);
    process.exit(1);
  }
  console.log(`El usuario ya existía: se actualizó la contraseña.`);
} else {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error(`No se pudo crear el usuario: ${error.message}`);
    process.exit(1);
  }
  user = data.user;
  console.log("Usuario creado y confirmado.");
}

const { data: existing } = await db
  .from("memberships")
  .select("id,rol")
  .eq("user_id", user.id)
  .eq("tenant_id", tenant.id)
  .maybeSingle();
const { error: memberError } = existing
  ? await db.from("memberships").update({ rol }).eq("id", existing.id)
  : await db.from("memberships").insert({ user_id: user.id, tenant_id: tenant.id, rol });
if (memberError) {
  console.error(`No se pudo asignar el rol: ${memberError.message}`);
  process.exit(1);
}
console.log(`Listo: ${email} es ${rol} de ${tenant.nombre}.`);
console.log(`Ingreso: https://clicksburger.vercel.app/t/${SLUG}/login`);
