import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { mapPedido } from "@/features/orders/mappers";
import {
  descargarArchivo,
  pendientesDelTurno,
  totalPedido,
  turnoArchivo,
  turnoCsv,
  ventasDelTurno,
} from "../turno-report";
import type { Database } from "@/types/db.types";
import type { Pedido } from "@/types/domain";

export type CajaTurno = Database["public"]["Tables"]["caja_turnos"]["Row"];

/** Turno abierto del local (cerrado_en null), o null si no hay. */
export async function getTurnoAbierto(tenantId: string): Promise<CajaTurno | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("caja_turnos")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("cerrado_en", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function abrirCaja(input: {
  tenantId: string;
  userId: string;
  email: string | null;
  montoInicial: number;
  nota: string | null;
}): Promise<CajaTurno> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("caja_turnos")
    .insert({
      tenant_id: input.tenantId,
      abierto_por: input.userId,
      abierto_por_email: input.email,
      monto_inicial: input.montoInicial,
      nota_apertura: input.nota,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay una caja abierta en este local.");
    throw new Error(error.message);
  }
  return data;
}

/** Ventas (total con envíos, cantidad de pedidos entregados y envíos) desde un instante hasta ahora. */
export async function ventasActuales(
  tenantId: string,
  desde: string,
): Promise<{ total: number; cantidad: number; envios: number }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("caja_ventas", {
    p_tenant_id: tenantId,
    p_desde: desde,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return {
    total: Number(row?.total ?? 0),
    cantidad: Number(row?.cantidad ?? 0),
    envios: Number(row?.envios ?? 0),
  };
}

export async function cerrarCaja(
  turnoId: string,
  montoFinal: number,
  nota: string | null,
): Promise<CajaTurno> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("cerrar_caja", {
    p_turno_id: turnoId,
    p_monto_final: montoFinal,
    p_nota: nota ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as CajaTurno;
}

/**
 * Pedidos del turno: los entregados (por hora de entrega, el mismo criterio
 * que caja_ventas) y los que entraron en el turno pero nadie cerró en el
 * sistema (sin confirmar, en cocina o listos) = ventas potenciales.
 */
export async function pedidosDelTurno(
  tenantId: string,
  desde: string,
  hasta: string | null,
): Promise<{ entregados: Pedido[]; pendientes: Pedido[] }> {
  const supabase = createSupabaseBrowserClient();
  const from = new Date(new Date(desde).getTime() - 86400000).toISOString();
  const until = hasta ?? new Date().toISOString();
  const rows: Pedido[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("estado", ["entregado", "nuevo", "confirmado", "en_cocina", "listo"])
      .gte("creado_en", from)
      .lte("creado_en", until)
      .order("num")
      .range(offset, offset + 499);
    if (error) throw new Error("No se pudieron leer los pedidos del turno.");
    rows.push(...(data ?? []).map(mapPedido));
    if (!data || data.length < 500) break;
  }
  return {
    entregados: ventasDelTurno(rows, desde, hasta),
    pendientes: pendientesDelTurno(rows, desde, hasta),
  };
}

/** Cuántos pedidos que entraron en el turno se rechazaron (no son ventas). */
export async function rechazadosActuales(tenantId: string, desde: string): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const { count, error } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("estado", "rechazado")
    .gte("creado_en", desde);
  if (error) throw new Error("No se pudieron contar los rechazados del turno.");
  return count ?? 0;
}

/** Pedidos del turno sin cerrar en el sistema: cantidad y total (ventas potenciales). */
export async function pendientesActuales(tenantId: string, desde: string) {
  const { pendientes } = await pedidosDelTurno(tenantId, desde, null);
  return {
    cantidad: pendientes.length,
    total: pendientes.reduce((sum, p) => sum + totalPedido(p), 0),
  };
}

/** Descarga el Excel (CSV) de un turno: resumen, ventas potenciales, pagos, productos y detalle. */
export async function descargarExcelTurno(tenantId: string, turno: CajaTurno) {
  const { entregados, pendientes } = await pedidosDelTurno(
    tenantId,
    turno.abierto_en,
    turno.cerrado_en,
  );
  descargarArchivo(turnoArchivo(turno), turnoCsv(turno, entregados, pendientes));
}

/** Historial de turnos cerrados (para el admin). */
export async function listarTurnos(tenantId: string, limit = 30): Promise<CajaTurno[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("caja_turnos")
    .select("*")
    .eq("tenant_id", tenantId)
    .not("cerrado_en", "is", null)
    .order("abierto_en", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
