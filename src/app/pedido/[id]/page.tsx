import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { obtenerSeguimiento } from "@/features/orders/seguimiento.server";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { BUSINESS_SLUG } from "@/constants/business";
import { SeguimientoPedido } from "@/features/orders/components/SeguimientoPedido";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pedido — Clicks Burger",
  robots: { index: false, follow: false },
};

/** Seguimiento público de un pedido: el link llega al cliente al confirmar y por WhatsApp. */
export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [pedido, tenant] = await Promise.all([
    obtenerSeguimiento(id),
    getTenantBySlug(BUSINESS_SLUG),
  ]);
  if (!pedido) notFound();
  return <SeguimientoPedido inicial={pedido} horarios={tenant?.horarios ?? null} />;
}
