/** Constructores de rutas tenant-aware. Evita strings sueltos por toda la app. */
export const routes = {
  menu: (slug: string) => `/t/${slug}/menu`,
  login: (slug: string) => `/t/${slug}/login`,
  caja: (slug: string) => `/t/${slug}/caja`,
  cocina: (slug: string) => `/t/${slug}/cocina`,
  dashboard: (slug: string) => `/t/${slug}/dashboard`,
  settings: (slug: string) => `/t/${slug}/settings`,
  cierre: (slug: string) => `/t/${slug}/cierre`,
  ticket: (slug: string, num: number) => `/t/${slug}/ticket?num=${num}`,
  superadmin: "/superadmin",
  superadminLogin: "/superadmin/login",
} as const;
