import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { mapPedido } from "@/features/orders/mappers";
import { getTurnoAbierto } from "@/features/caja/services/caja.client";
import type { Pedido } from "@/types/domain";

export async function loadDashboard(tenantId: string, from: string, until: string) {
  const supabase = createSupabaseBrowserClient();
  async function periodOrders() {
    const orders: Pedido[] = [];
    // Paginar evita truncar los reportes al límite de filas de Supabase.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("creado_en", from)
        .lte("creado_en", until)
        .order("creado_en", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (error) throw new Error("No se pudieron leer los pedidos del período.");
      orders.push(...(data ?? []).map(mapPedido));
      if (!data || data.length < 500) return orders;
    }
  }
  const [orders, menu, active, shift] = await Promise.all([
    periodOrders(),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("activo", true),
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("estado", ["nuevo", "confirmado", "en_cocina", "listo"]),
    getTurnoAbierto(tenantId),
  ]);
  if (menu.error || active.error) throw new Error("No se pudo cargar el estado del local.");
  return { orders, menuCount: menu.count ?? 0, activeCount: active.count ?? 0, shift };
}
