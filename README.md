# Clicks — Comandera SaaS (Next.js + Supabase)

Sistema de comandera **multi-tenant** para gastronomía: pantalla de pedidos para el
cliente, y paneles de caja y cocina en tiempo real, con branding por restaurante.

Esta app (`clicks-next/`) es la migración del sistema legacy (HTML/CSS/JS + Express)
a una arquitectura moderna. El legacy queda intacto en la carpeta padre.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Lenguaje | TypeScript (modo estricto) |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) — **único backend** |
| Estilos | Tailwind CSS con tokens en variables CSS (branding dinámico por tenant) |
| Estado | Zustand (cola de pedidos en vivo, carrito) + Context (tenant, sesión) |
| Validación | Zod |
| Calidad | ESLint + Prettier |

No hay capa de API propia: el front habla directamente con Supabase vía `supabase-js`,
y la **RLS** (seguridad a nivel de fila) hace cumplir el aislamiento multi-tenant.

---

## Puesta en marcha

```bash
cd clicks-next
npm install
cp .env.example .env.local   # completar con las claves de Supabase
npm run dev                  # http://localhost:3000
```

Verificación recomendada:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # build de producción
```

### Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key pública>
SUPABASE_SERVICE_ROLE_KEY=<service role — SOLO servidor, secreta>
SUPERADMIN_EMAIL=<email del admin de plataforma>   # opcional
```

---

## Base de datos

Las migraciones versionadas están en `supabase/migrations/` (idempotentes):

1. `0001_init.sql` — tablas, enum de roles, función de numeración, Realtime.
2. `0002_rls.sql` — políticas RLS multi-tenant.
3. `0003_storage.sql` — bucket público `tenant-assets`.

Tablas principales:

- **tenants** — restaurantes (slug, nombre, colores de branding, logo, activo).
- **memberships** — vincula `auth.users` ↔ `tenant` con un **rol** (`admin` / `cajero` / `cocina`).
- **platform_admins** — usuarios superadmin de plataforma.
- **menu_items** — productos del menú (precio base si no tiene variantes).
- **menu_variants** — variantes de un producto (ej. Simple / Doble / Triple, cada una con su precio).
- **pedidos** — pedidos (estado, tipo, items en JSONB, demora, timestamps).

### Crear usuarios

La autenticación usa **Supabase Auth** (no se guardan contraseñas en las tablas):

1. Crear el usuario en *Authentication → Users* (tildar "Auto Confirm User").
2. Vincularlo a un tenant con un rol:
   ```sql
   insert into public.memberships (user_id, tenant_id, rol)
   values ('<auth_user_id>', (select id from tenants where slug = 'clicks-burger'), 'admin');
   ```
3. Para un superadmin de plataforma:
   ```sql
   insert into public.platform_admins (user_id) values ('<auth_user_id>');
   ```

---

## Modelo de seguridad (RLS)

La seguridad vive en la base de datos, no solo en la app:

- Un pedido solo lo leen los **miembros** de ese tenant (caja/cocina/admin) o un superadmin.
- El menú es de **lectura pública** (lo ve el cliente), pero solo lo modifica el **admin** del tenant.
- Un cliente anónimo puede **crear** un pedido en un tenant activo, pero no leer pedidos.
- El branding lo edita solo el admin del tenant; los tenants los crea/elimina solo un superadmin.

El rol y el tenant del usuario salen de su JWT (`auth.uid()`), así un usuario de un
restaurante no puede acceder a los datos de otro aunque la app tuviera un bug.

---

## Arquitectura de carpetas

```
src/
├── app/                      Rutas, layouts y páginas (sin lógica de negocio)
│   ├── t/[slug]/             Espacio del tenant (resuelve branding 1 vez)
│   │   ├── (public)/menu     Pantalla del cliente
│   │   ├── (staff)/          Caja, cocina, dashboard, settings (auth + rol)
│   │   ├── login, ticket
│   └── (superadmin)/         Panel de plataforma
├── features/                 Dominios: orders, menu, tenants, auth
│   └── <feature>/            components / hooks / services / store
├── components/               UI compartida: ui, forms, layouts, settings, superadmin
├── services/supabase/        Clientes browser / server / admin
├── contexts/                 TenantContext, SessionContext
├── constants/                Estados de pedido, roles, rutas
├── lib/  utils/  types/      Infra, helpers puros, tipos de dominio y de DB
```

Principio clave: cada **feature** agrupa todo lo suyo (componentes, hooks, servicios,
store, tipos). La UI compartida y sin lógica de negocio vive en `components/`.

---

## Tiempo real

Caja y cocina comparten el hook `useOrders(tenantId)`, que abre **una sola**
suscripción a Supabase Realtime filtrada por tenant. Cualquier alta/cambio/baja de
pedido (desde el menú, otra caja u otro dispositivo) se propaga al instante a todas
las pantallas del staff de ese tenant. Reemplaza los 4 mecanismos del legacy
(SSE + Realtime + BroadcastChannel + localStorage).

---

## Rutas de la aplicación

> No hay endpoints REST propios: los datos se operan vía `supabase-js` + RLS.
> El acceso indicado se aplica por middleware y/o guard en la página.

### Plataforma

| Ruta | Descripción | Acceso |
|------|-------------|--------|
| `/` | Redirige al panel de superadmin | Pública |
| `/superadmin/login` | Login del superadmin de plataforma | Pública |
| `/superadmin` | Panel: métricas + gestión de tenants | `platform_admin` |

### Por tenant — `/t/[slug]`

| Ruta | Descripción | Acceso |
|------|-------------|--------|
| `/t/[slug]` | Redirige al menú del cliente | Pública |
| `/t/[slug]/menu` | Menú y armado de pedido del cliente | Pública |
| `/t/[slug]/login` | Login de staff | Pública |
| `/t/[slug]/ticket?num=N` | Ticket de impresión de un pedido | Staff (datos por RLS) |
| `/t/[slug]/dashboard` | Inicio del staff | Autenticado (cualquier rol) |
| `/t/[slug]/caja` | Caja: recibir/confirmar/entregar pedidos | `admin`, `cajero` |
| `/t/[slug]/cocina` | Cocina: preparación, tiempos | `admin`, `cocina` |
| `/t/[slug]/settings` | Branding + CRUD de menú + contraseña | `admin` |

---

## Operaciones de datos (Supabase)

En lugar de endpoints HTTP, la app usa estas operaciones (todas sujetas a RLS):

- **Pedidos:** `next_pedido_num` (RPC), insert (cliente anónimo), select/update/delete (staff),
  más suscripción Realtime a `pedidos`.
- **Menú:** select de `menu_items` + `menu_variants` (público); insert/update/delete (admin).
- **Tenants:** select (público para activos), update branding (admin), insert/delete (superadmin).
- **Storage:** subida de logo y de imágenes de producto al bucket `tenant-assets`.
- **Auth:** `signInWithPassword`, `signOut`, `updateUser` (cambio de contraseña).

---

## Estado de la migración

- [x] Paso 1 — Fundación (configs, tokens, migraciones, tipos, clientes)
- [x] Paso 2 — Layout del tenant + branding
- [x] Paso 3 — Primitivas UI
- [x] Paso 4 — Pantalla del cliente (menú + pedido)
- [x] Paso 5 — Auth (Supabase Auth + memberships + RLS)
- [x] Paso 6 — Dominio de pedidos (store + Realtime + máquina de estados)
- [x] Paso 7 — Caja + Cocina
- [x] Paso 8 — Settings (branding + CRUD de menú)
- [x] Paso 9 — Superadmin
- [x] Paso 10 — Ticket de impresión

### Mejoras futuras

- Gestión de usuarios/staff desde el panel (requiere Admin API con service role).
- Carrusel del menú como componente visual opcional.
- Apagar el server Express legacy y eliminar columnas `admin_user` / `admin_pass_hash`.
