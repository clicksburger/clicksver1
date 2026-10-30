import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { getMenu } from "@/features/menu/services/menu.service";
import { MenuClient } from "@/features/menu/components/MenuClient";

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const items = await getMenu(tenant.id);
  return <MenuClient tenant={tenant} items={items} />;
}
