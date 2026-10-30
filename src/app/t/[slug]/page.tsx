import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";

export default async function TenantIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(routes.menu(slug));
}
