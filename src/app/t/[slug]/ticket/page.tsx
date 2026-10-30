import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/features/tenants/services/tenants.service";
import { createSupabaseServerClient } from "@/services/supabase/server";
import { mapPedido } from "@/features/orders/mappers";
import { Ticket } from "@/features/orders/components/Ticket";

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ num?: string }>;
}) {
  const { slug } = await params;
  const { num } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("pedidos")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("num", Number(num))
    .maybeSingle();

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted">
        Pedido no encontrado.
      </main>
    );
  }

  return <Ticket pedido={mapPedido(data)} tenantNombre={tenant.nombre} />;
}
