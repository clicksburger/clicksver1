import { permanentRedirect } from "next/navigation";
import { routes } from "@/constants/routes";

/** La carta se publica en la raíz del sitio; esta dirección vieja redirige allá. */
export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(routes.menu(slug));
}
