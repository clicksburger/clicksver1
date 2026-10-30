import type { CSSProperties } from "react";
import type { Tenant } from "@/types/domain";

/**
 * Devuelve las variables CSS de branding del tenant para inyectar como
 * style inline. Solo se sobreescriben los tokens dinámicos; el resto
 * (border, danger, etc.) hereda los defaults de globals.css.
 */
export function brandingVars(tenant: Tenant): CSSProperties {
  if (tenant.slug === "clicks-burger") {
    return {
      "--color-primary": "#ffd21c",
      "--color-primary-soft": "#ffe574",
      "--color-bg": "#131e24",
      "--color-surface": "#1c2a31",
      "--color-surface-2": "#23343c",
      "--color-surface-3": "#2d414a",
      "--color-text": "#fff8df",
      "--color-muted": "#b9c2c1",
      "--color-border": "#3a4b53",
    } as CSSProperties;
  }
  return {
    "--color-primary": tenant.colorPrimario,
    "--color-bg": tenant.colorFondo,
    "--color-surface": tenant.colorSurface,
    "--color-text": tenant.colorTexto,
  } as CSSProperties;
}
