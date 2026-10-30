import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantProvider } from "@/contexts/TenantContext";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { brandingVars } from "@/features/tenants/branding";
import { getMenu } from "@/features/menu/services/menu.service";
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
  const items = await getMenu(tenant.id);
  return (
    <TenantProvider tenant={tenant}>
      <div style={brandingVars(tenant)} className="clicks-app min-h-screen bg-bg text-text">
        <MenuClient tenant={tenant} items={items} />
      </div>
    </TenantProvider>
  );
}
