import { notFound, redirect } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { getStaffSession } from "@/features/auth/session";
import { SessionProvider } from "@/contexts/SessionContext";
import { StaffShell } from "@/components/layouts/StaffShell";
import { routes } from "@/constants/routes";

export default async function StaffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const session = await getStaffSession(tenant.id);
  if (!session) redirect(routes.login(slug));

  return (
    <SessionProvider session={session}>
      <StaffShell slug={slug} tenantNombre={tenant.nombre}>
        {children}
      </StaffShell>
    </SessionProvider>
  );
}
