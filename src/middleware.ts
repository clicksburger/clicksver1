import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const STAFF_RE = /^\/t\/([^/]+)\/(caja|cocina|dashboard|settings)(\/|$)/;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // getSession() lee la sesión de la cookie (y la renueva si venció) sin ir a
  // Supabase en cada clic. Acá solo decide si redirigir al login: la validación
  // real del usuario y su rol la hace getStaffSession()/getSuperadminSession()
  // con getUser() en el servidor, antes de mostrar cualquier dato.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const hasSession = Boolean(session);

  const { pathname } = req.nextUrl;

  // Rutas de staff por tenant
  const staff = pathname.match(STAFF_RE);
  if (staff && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = `/t/${staff[1]}/login`;
    return NextResponse.redirect(url);
  }

  // Superadmin (la verificación de platform_admin se hace en la página)
  if (pathname.startsWith("/superadmin") && pathname !== "/superadmin/login" && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/superadmin/login";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // Solo corre donde hace falta sesión: secciones de staff y superadmin.
  // Las páginas públicas (menú, login, ticket) no pagan el costo del getUser().
  matcher: [
    "/superadmin/:path*",
    "/t/:slug/caja/:path*",
    "/t/:slug/cocina/:path*",
    "/t/:slug/dashboard/:path*",
    "/t/:slug/settings/:path*",
  ],
};
