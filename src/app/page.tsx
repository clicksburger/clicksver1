import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantProvider } from "@/contexts/TenantContext";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { brandingVars } from "@/features/tenants/branding";
import { getMenuActivo } from "@/features/menu/services/menu.service";
import { disponibleHoy, promoDelDiaActiva, slidesCarrusel } from "@/features/menu/carrusel";
import { MenuClient } from "@/features/menu/components/MenuClient";
import { BUSINESS_SLUG } from "@/constants/business";

export const metadata: Metadata = {
  title: "Clicks Burger — Pedí online",
  description: "El gusto de volver. Pedí Clicks para retirar o con delivery.",
};

/**
 * La carta pública vive en la raíz: es la URL que se comparte en redes y la
 * del QR del mostrador. /t/clicks-burger/menu redirige acá.
 * Mismo armado que el layout del tenant + la página del menú.
 */
export default async function Home() {
  const tenant = await getTenantBySlug(BUSINESS_SLUG);
  if (!tenant) notFound();
  const todos = await getMenuActivo(tenant.id);
  // Carta y carrusel del día: la promo del día solo aparece (y se vende) cuando está activa.
  const now = new Date();
  const items = todos.filter((item) => disponibleHoy(item, tenant.carrusel, now));
  const slides = slidesCarrusel(todos, tenant.carrusel, now);
  const resaltados = promoDelDiaActiva(tenant.carrusel, now) ? tenant.carrusel.promo : [];
  return (
    <TenantProvider tenant={tenant}>
      <div style={brandingVars(tenant)} className="clicks-app min-h-screen bg-bg text-text">
        <MenuClient tenant={tenant} items={items} slides={slides} resaltados={resaltados} />
      </div>
    </TenantProvider>
  );
}
