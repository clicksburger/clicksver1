import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { getStaffSession } from "@/features/auth/session";
import { CocinaBoard } from "@/features/orders/components/CocinaBoard";
import { routes } from "@/constants/routes";
import { ACCESO_SECCION } from "@/constants/roles";

export default async function CocinaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const session = await getStaffSession(tenant.id);
  if (!session) redirect(routes.login(slug));
  if (!ACCESO_SECCION.cocina.includes(session.rol)) redirect(routes.dashboard(slug));

  return <CocinaBoard tenantId={tenant.id} slug={slug} />;
}
