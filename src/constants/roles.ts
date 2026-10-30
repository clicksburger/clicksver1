export const ROLES = ["admin", "cajero", "cocina"] as const;
export type RolStaff = (typeof ROLES)[number];

export const ROL_LABEL: Record<RolStaff, string> = {
  admin: "Administrador",
  cajero: "Cajero",
  cocina: "Cocina",
};

/** Qué roles pueden acceder a cada sección de staff. */
export const ACCESO_SECCION: Record<
  "caja" | "cocina" | "dashboard" | "settings" | "cierre",
  readonly RolStaff[]
> = {
  caja: ["admin", "cajero"],
  cocina: ["admin", "cocina"],
  dashboard: ["admin"],
  settings: ["admin"],
  cierre: ["admin", "cajero"],
};
