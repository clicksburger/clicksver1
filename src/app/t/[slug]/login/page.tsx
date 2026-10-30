import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { getStaffSession } from "@/features/auth/session";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { routes } from "@/constants/routes";
import Link from "next/link";
import { ChefHat, ShoppingBag, Wallet } from "lucide-react";
import "./login.css";
import { ClicksLogo } from "@/components/ui/ClicksLogo";

export default async function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const session = await getStaffSession(tenant.id);
  if (session) redirect(routes.dashboard(slug));

  return (
    <main className="clicks-login">
      <section className="cl-story">
        <Link href={routes.menu(slug)} className="cl-brand" aria-label="Ver menú de Clicks Burger">
          <ClicksLogo />
        </Link>
        <div className="cl-message">
          <span className="cl-sticker">El equipo de Clicks</span>
          <h1>
            Buenas burgers. <br />
            Buen equipo.
          </h1>
          <p>
            El espacio de Clicks para organizar los pedidos, acompañar a la cocina y llevar las
            cuentas del local.
          </p>
        </div>
        <div className="cl-features">
          <span>
            <ShoppingBag size={17} /> Pedidos
          </span>
          <span>
            <ChefHat size={17} /> Cocina
          </span>
          <span>
            <Wallet size={17} /> Caja
          </span>
        </div>
      </section>
      <section className="cl-access">
        <div className="cl-form-wrap">
          <p className="cl-local">Clicks Burger</p>
          <h2>Vamos a trabajar.</h2>
          <p className="cl-intro">Ingresá con tu cuenta para administrar el local.</p>
          <LoginForm slug={slug} tenantId={tenant.id} />
          <p className="cl-help">
            Acceso exclusivo para el equipo. Si necesitás una cuenta, pedísela al administrador del
            local.
          </p>
          <Link href={routes.menu(slug)} className="cl-menu">
            ¿Venís a pedir? Mirá nuestro menú
          </Link>
        </div>
        <p className="cl-footer">Clicks Burger · Gestión del local</p>
      </section>
    </main>
  );
}
