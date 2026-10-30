"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { useOrdersStore } from "../store/orders.store";
import { fetchPedidos, updatePedido, deletePedido, clearPedidos } from "../services/orders.service";
import { mapPedido, type PedidoRow } from "../mappers";
import { transicion } from "../transitions";
import type { EstadoPedido } from "@/constants/order-states";
import type { Pedido, PedidoItem, TipoPedido } from "@/types/domain";
import type { Json } from "@/types/db.types";
import { attachCheckout } from "../checkout";

/**
 * Conecta el store de pedidos a Supabase Realtime para un tenant.
 * Carga la cola inicial y mantiene UNA suscripción (insert/update/delete).
 * Expone las acciones de cambio de estado validadas por la máquina de estados.
 */
export function useOrders(tenantId: string) {
  const pedidos = useOrdersStore((s) => s.pedidos);
  const setAll = useOrdersStore((s) => s.setAll);
  const upsert = useOrdersStore((s) => s.upsert);
  const removeByNum = useOrdersStore((s) => s.removeByNum);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    fetchPedidos(tenantId)
      .then((p) => active && setAll(p))
      .catch(() => active && setAll([]));

    const channel = supabase
      .channel(`pedidos:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removeByNum((payload.old as Partial<PedidoRow>).num as number);
          } else {
            upsert(mapPedido(payload.new as PedidoRow));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tenantId, setAll, upsert, removeByNum]);

  // ── Acciones (escriben en Supabase; Realtime sincroniza al resto) ──
  const cambiarEstado = (p: Pedido, hacia: EstadoPedido, extra?: { demora?: number }) =>
    updatePedido(p.id, transicion(p.estado, hacia, extra));

  const eliminar = async (p: Pedido) => {
    removeByNum(p.num); // optimista: desaparece al instante
    try {
      await deletePedido(p.id);
    } catch (e) {
      upsert(p); // revertir si el borrado falla
      throw e;
    }
  };

  const editar = (
    p: Pedido,
    patch: {
      nombre?: string | null;
      tipo?: TipoPedido;
      items?: PedidoItem[];
      costoEnvio?: number | null;
    },
  ) =>
    updatePedido(p.id, {
      ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
      ...(patch.tipo !== undefined ? { tipo: patch.tipo } : {}),
      ...(patch.costoEnvio !== undefined ? { costo_envio: patch.costoEnvio } : {}),
      ...(patch.items !== undefined
        ? { items: attachCheckout(patch.items, p.checkout) as unknown as Json }
        : {}),
    });

  const limpiarTodos = () => clearPedidos(tenantId);

  return { pedidos, cambiarEstado, eliminar, editar, limpiarTodos };
}
