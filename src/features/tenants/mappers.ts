import type { Database } from "@/types/db.types";
import type { Tenant } from "@/types/domain";
import { horariosFromJson } from "./horarios";
import { envioConfigFromJson } from "@/features/envios/tarifas";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];

/** Convierte una fila de la tabla `tenants` al modelo de dominio (camelCase). */
export function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    nombre: row.nombre,
    colorPrimario: row.color_primario,
    colorFondo: row.color_fondo,
    colorSurface: row.color_surface,
    colorTexto: row.color_texto,
    logoUrl: row.logo_url,
    activo: row.activo,
    horarios: row.horarios == null ? null : horariosFromJson(row.horarios),
    envio: envioConfigFromJson(row.envio_config),
  };
}
