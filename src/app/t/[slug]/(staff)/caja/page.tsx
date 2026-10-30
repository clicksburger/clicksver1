import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { getStaffSession } from "@/features/auth/session";
import { CajaBoard } from "@/features/orders/components/CajaBoard";
import { routes } from "@/constants/routes";
import { ACCESO_SECCION } from "@/constants/roles";

export default async function CajaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const session = await getStaffSession(tenant.id);
  if (!session) redirect(routes.login(slug));
  if (!ACCESO_SECCION.caja.includes(session.rol)) redirect(routes.dashboard(slug));

  return <CajaBoard tenantId={tenant.id} slug={slug} />;
}
