import { create } from "zustand";
import type { PedidoItem } from "@/types/domain";

export interface CartLine {
  key: string; // Producto + opciones + observaciones: solo combina pedidos idénticos.
  itemId: string;
  nombre: string;
  variante: string | null;
  precio: number;
  cantidad: number;
  obs?: string;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, "key" | "cantidad">) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const keyOf = (itemId: string, variante: string | null, obs: string) =>
  JSON.stringify([itemId, variante, obs]);

export const useCartStore = create<CartState>((set) => ({
  lines: [],
  add: (line) =>
    set((state) => {
      const obs = line.obs?.trim().slice(0, 150) ?? "";
      const key = keyOf(line.itemId, line.variante, obs);
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        return {
          lines: state.lines.map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + 1 } : l)),
        };
      }
      return { lines: [...state.lines, { ...line, obs: obs || undefined, key, cantidad: 1 }] };
    }),
  increment: (key) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.key === key ? { ...l, cantidad: l.cantidad + 1 } : l)),
    })),
  decrement: (key) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.key === key ? { ...l, cantidad: l.cantidad - 1 } : l))
        .filter((l) => l.cantidad > 0),
    })),
  remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
  clear: () => set({ lines: [] }),
}));

/** Selectores derivados (fuera del store para no recalcular en cada set). */
export const cartTotal = (lines: CartLine[]) =>
  lines.reduce((acc, l) => acc + l.precio * l.cantidad, 0);

export const cartCount = (lines: CartLine[]) => lines.reduce((acc, l) => acc + l.cantidad, 0);

export const cartToPedidoItems = (lines: CartLine[]): PedidoItem[] =>
  lines.map((l) => ({
    itemId: l.itemId,
    nombre: l.nombre,
    variante: l.variante,
    cantidad: l.cantidad,
    precio: l.precio,
    ...(l.obs ? { obs: l.obs } : {}),
  }));
