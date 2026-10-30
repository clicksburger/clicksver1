"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Wallet,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Monitor,
  Maximize,
  Minimize,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useSession } from "@/contexts/SessionContext";
import { signOut } from "@/features/auth/services/auth.service";
import { routes } from "@/constants/routes";
import { ClicksLogo } from "@/components/ui/ClicksLogo";
import { ACCESO_SECCION, ROL_LABEL, type RolStaff } from "@/constants/roles";
import "./operations.css";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly RolStaff[];
}

export function StaffShell({
  slug,
  tenantNombre,
  children,
}: {
  slug: string;
  tenantNombre: string;
  children: React.ReactNode;
}) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [monitorMode, setMonitorMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const operational = pathname === routes.caja(slug) || pathname === routes.cocina(slug);

  useEffect(() => {
    try {
      setSidebarHidden(localStorage.getItem("clicks:sidebar-hidden") === "true");
      setMonitorMode(localStorage.getItem("clicks:monitor-mode") === "true");
    } catch {
      /* El modo sigue disponible sin almacenamiento persistente. */
    }
    const sync = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function setSidebar(hidden: boolean) {
    setSidebarHidden(hidden);
    try {
      localStorage.setItem("clicks:sidebar-hidden", String(hidden));
    } catch {
      /* optional */
    }
  }
  function setMonitor(enabled: boolean) {
    setMonitorMode(enabled);
    setSidebar(enabled);
    try {
      localStorage.setItem("clicks:monitor-mode", String(enabled));
    } catch {
      /* optional */
    }
  }
  async function toggleFullscreen() {
    setScreenError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setMonitor(true);
      } else
        setScreenError(
          "Este navegador no admite pantalla completa. Podés usar el modo monitor y ocultar el menú.",
        );
    } catch {
      setScreenError("No se pudo activar la pantalla completa. El modo monitor sigue disponible.");
    }
  }

  const links: NavLink[] = (
    [
      {
        href: routes.dashboard(slug),
        label: "Resumen del local",
        icon: LayoutDashboard,
        roles: ACCESO_SECCION.dashboard,
      },
      { href: routes.caja(slug), label: "Caja", icon: Wallet, roles: ACCESO_SECCION.caja },
      { href: routes.cierre(slug), label: "Cierre", icon: Receipt, roles: ACCESO_SECCION.cierre },
      { href: routes.cocina(slug), label: "Cocina", icon: ChefHat, roles: ACCESO_SECCION.cocina },
      {
        href: routes.settings(slug),
        label: "Configuración",
        icon: Settings,
        roles: ACCESO_SECCION.settings,
      },
    ] satisfies NavLink[]
  ).filter((l) => l.roles.includes(session.rol));

  // "Inicio" se accede desde el logo. Admin -> dashboard; otros roles -> su
  // primera seccion disponible (el dashboard es solo para admin).
  const homeHref =
    session.rol === "admin" ? routes.dashboard(slug) : (links[0]?.href ?? routes.dashboard(slug));

  // Cerrar el drawer al navegar.
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Escape + scroll-lock mientras el drawer esta abierto.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  async function logout() {
    await signOut();
    router.replace(routes.login(slug));
    router.refresh();
  }

  const Logo = ({ onClick }: { onClick?: () => void }) => (
    <Link
      href={homeHref}
      onClick={onClick}
      aria-label="Ir al inicio"
      className="flex items-center gap-2.5 rounded-lg p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <ClicksLogo />
      <span className="sr-only">{tenantNombre}</span>
    </Link>
  );

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const Icon = l.icon;
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "bg-surface3 text-primary" : "text-muted hover:bg-surface2 hover:text-text",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  const Footer = () => (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Badge tone="primary">{ROL_LABEL[session.rol]}</Badge>
        <span className="truncate text-xs text-muted">{session.email}</span>
      </div>
      <button
        onClick={logout}
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold text-muted transition hover:bg-surface2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" /> Salir
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        "staff-shell flex min-h-screen flex-col lg:flex-row",
        monitorMode && operational && "staff-monitor",
      )}
    >
      {/* Desktop: sidebar fijo */}
      <aside
        id="staff-sidebar"
        className={cn(
          "no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface p-3",
          !sidebarHidden && "lg:flex",
        )}
      >
        <div className="px-1 py-2">
          <Logo />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <Footer />
      </aside>

      {/* Movil: top bar con hamburguesa */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-text transition hover:bg-surface2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu className="h-6 w-6" />
        </button>
        <Logo />
      </header>

      {/* Movil: drawer lateral */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-0 z-50 animate-fade-in bg-black/60 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] animate-slide-in-left flex-col border-r border-border bg-surface p-3 shadow-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <Logo onClick={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setDrawerOpen(false)} />
            </div>
            <Footer />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="ops-screen-toolbar no-print" aria-label="Opciones de pantalla">
          <button
            type="button"
            onClick={() => setSidebar(!sidebarHidden)}
            aria-controls="staff-sidebar"
            aria-expanded={!sidebarHidden}
            className="hidden lg:inline-flex"
          >
            {sidebarHidden ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            {sidebarHidden ? "Mostrar menú lateral" : "Ocultar menú lateral"}
          </button>
          {operational && (
            <>
              <button
                type="button"
                aria-pressed={monitorMode}
                onClick={() => setMonitor(!monitorMode)}
              >
                <Monitor size={19} />
                {monitorMode ? "Volver a escritorio" : "Modo monitor"}
              </button>
              <button type="button" onClick={() => void toggleFullscreen()}>
                {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
                {fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              </button>
            </>
          )}
        </div>
        {screenError && (
          <p role="status" className="px-5 py-2 text-sm text-muted">
            {screenError}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
