import { notFound } from "next/navigation";
import { TenantProvider } from "@/contexts/TenantContext";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { brandingVars } from "@/features/tenants/branding";
import { BUSINESS_SLUG } from "@/constants/business";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug !== BUSINESS_SLUG) notFound();
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <TenantProvider tenant={tenant}>
      <div style={brandingVars(tenant)} className="clicks-app min-h-screen bg-bg text-text">
        {children}
      </div>
    </TenantProvider>
  );
}
