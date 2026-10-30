import { createSupabaseBrowserClient } from "@/services/supabase/client";
import type { Database } from "@/types/db.types";

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

/** Ventas (total + cantidad de pedidos entregados) desde un instante hasta ahora. */
export async function ventasActuales(
  tenantId: string,
  desde: string,
): Promise<{ total: number; cantidad: number }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("caja_ventas", {
    p_tenant_id: tenantId,
    p_desde: desde,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return { total: Number(row?.total ?? 0), cantidad: Number(row?.cantidad ?? 0) };
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
