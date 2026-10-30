import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { getStaffSession } from "@/features/auth/session";
import { routes } from "@/constants/routes";
import { ClicksDashboard } from "@/components/dashboard/ClicksDashboard";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const session = await getStaffSession(tenant.id);
  if (!session) redirect(routes.login(slug));
  if (session.rol !== "admin") {
    redirect(session.rol === "cocina" ? routes.cocina(slug) : routes.caja(slug));
  }
  return <ClicksDashboard tenant={tenant} />;
}
