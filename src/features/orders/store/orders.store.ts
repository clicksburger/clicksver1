import { create } from "zustand";
import type { EstadoPedido } from "@/constants/order-states";
import type { Pedido } from "@/types/domain";

interface OrdersState {
  pedidos: Pedido[];
  setAll: (pedidos: Pedido[]) => void;
  upsert: (pedido: Pedido) => void;
  removeByNum: (num: number) => void;
  clear: () => void;
}

const sortByNum = (a: Pedido, b: Pedido) => a.num - b.num;

export const useOrdersStore = create<OrdersState>((set) => ({
  pedidos: [],
  setAll: (pedidos) => set({ pedidos: [...pedidos].sort(sortByNum) }),
  upsert: (pedido) =>
    set((state) => {
      const idx = state.pedidos.findIndex((p) => p.num === pedido.num);
      if (idx === -1) return { pedidos: [...state.pedidos, pedido].sort(sortByNum) };
      const next = state.pedidos.slice();
      next[idx] = pedido;
      return { pedidos: next };
    }),
  removeByNum: (num) => set((state) => ({ pedidos: state.pedidos.filter((p) => p.num !== num) })),
  clear: () => set({ pedidos: [] }),
}));

/** Selector: filtra la cola por uno o más estados. */
export const pedidosPorEstado = (pedidos: Pedido[], estados: EstadoPedido[]) =>
  pedidos.filter((p) => estados.includes(p.estado));
