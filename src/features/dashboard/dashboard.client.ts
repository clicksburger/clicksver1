import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { mapPedido } from "@/features/orders/mappers";
import { getTurnoAbierto, type CajaTurno } from "@/features/caja/services/caja.client";
import { ventasDelTurno } from "@/features/caja/turno-report";
import { periodStart } from "./summary";
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
  return {
    orders,
    menuCount: menu.count ?? 0,
    activeCount: active.count ?? 0,
    shift,
    /** Turno que define el período cuando se elige "Turno" (null en los otros). */
    turno: null as CajaTurno | null,
  };
}

/**
 * Período "Turno": desde la apertura de la caja abierta o, si está cerrada, el
 * último turno cerrado. Las ventas empiezan de cero con cada apertura y se
 * cuentan por hora de entrega, igual que el cierre de caja.
 */
export async function loadShiftDashboard(tenantId: string) {
  const supabase = createSupabaseBrowserClient();
  let turno = await getTurnoAbierto(tenantId);
  if (!turno) {
    const { data } = await supabase
      .from("caja_turnos")
      .select("*")
      .eq("tenant_id", tenantId)
      .not("cerrado_en", "is", null)
      .order("abierto_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    turno = data;
  }
  const now = new Date().toISOString();
  if (!turno) return loadDashboard(tenantId, periodStart(1), now);
  const from = turno.abierto_en;
  const base = await loadDashboard(
    tenantId,
    new Date(new Date(from).getTime() - 86400000).toISOString(),
    turno.cerrado_en ?? now,
  );
  const delivered = ventasDelTurno(base.orders, from, turno.cerrado_en);
  const pending = base.orders.filter((o) => o.estado !== "entregado" && o.creadoEn >= from);
  const orders = [...delivered, ...pending].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  return { ...base, orders, turno };
}
