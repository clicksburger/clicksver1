"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ChevronDown } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { cn } from "@/lib/cn";
import { formatPrecio } from "@/lib/format";
import { fetchMenuAll } from "@/features/menu/services/menu.client";
import { groupByCategoria } from "@/features/menu/mappers";
import type { MenuItem, Pedido, PedidoItem, TipoPedido } from "@/types/domain";

const TIPOS: { key: TipoPedido; label: string }[] = [
  { key: "delivery", label: "Delivery" },
  { key: "salon", label: "Salón" },
  { key: "takeaway", label: "Take away" },
];

interface SavePatch {
  nombre: string | null;
  tipo: TipoPedido;
  items: PedidoItem[];
}

function EditForm({
  pedido,
  onClose,
  onSave,
}: {
  pedido: Pedido;
  onClose: () => void;
  onSave: (patch: SavePatch) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(pedido.nombre ?? "");
  const [tipo, setTipo] = useState<TipoPedido>(pedido.tipo);
  const [items, setItems] = useState<PedidoItem[]>(pedido.items.map((it) => ({ ...it })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Menú activo del tenant, para agregar productos al pedido.
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuQuery, setMenuQuery] = useState("");
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    fetchMenuAll(pedido.tenantId)
      .then((m) => {
        if (active) setMenu(m.filter((x) => x.activo));
      })
      .catch(() => {
        /* el editor sigue usable sin el selector si falla la carga */
      });
    return () => {
      active = false;
    };
  }, [pedido.tenantId]);

  const total = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);

  const setQty = (i: number, delta: number) =>
    setItems((arr) =>
      arr
        .map((it, idx) => (idx === i ? { ...it, cantidad: it.cantidad + delta } : it))
        .filter((it) => it.cantidad > 0),
    );

  const removeItem = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  // Agrega un producto del menú, mergeando por itemId + variante (igual que el carrito).
  const addProducto = (
    itemId: string,
    nombreItem: string,
    variante: string | null,
    precio: number,
  ) =>
    setItems((arr) => {
      const idx = arr.findIndex(
        (it) => it.itemId === itemId && (it.variante ?? "") === (variante ?? ""),
      );
      if (idx >= 0) {
        return arr.map((it, i) => (i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
      }
      return [...arr, { itemId, nombre: nombreItem, variante, cantidad: 1, precio }];
    });

  const q = menuQuery.trim().toLowerCase();
  const buscando = q.length > 0;
  const menuFiltrado = buscando ? menu.filter((m) => m.nombre.toLowerCase().includes(q)) : menu;
  const grupos = groupByCategoria(menuFiltrado);
  // Con búsqueda activa expandimos todo para revelar las coincidencias.
  const estaAbierta = (cat: string) => buscando || abiertas[cat] === true;
  const toggle = (cat: string) => setAbiertas((s) => ({ ...s, [cat]: !s[cat] }));

  async function guardar() {
    if (!items.length) {
      setError("El pedido debe conservar al menos un producto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ nombre: nombre.trim() || null, tipo, items });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Nombre" htmlFor="edit-nombre">
        <Input id="edit-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </FormField>

      <div className="flex gap-2">
        {TIPOS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTipo(t.key)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition",
              tipo === t.key
                ? "border-primary bg-primary text-bg"
                : "border-border text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-border">
        {items.length === 0 && (
          <p className="py-3 text-center text-sm text-muted">El pedido quedó sin ítems.</p>
        )}
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 py-2">
            <div className="flex-1">
              <p className="text-sm font-bold text-text">
                {it.nombre}
                {it.variante && <span className="text-muted"> · {it.variante}</span>}
              </p>
              <p className="text-xs text-muted">{formatPrecio(it.precio * it.cantidad)}</p>
            </div>
            <button
              onClick={() => setQty(i, -1)}
              className="rounded-md bg-surface3 p-1 hover:bg-surface2"
              aria-label="Restar"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm">{it.cantidad}</span>
            <button
              onClick={() => setQty(i, 1)}
              className="rounded-md bg-surface3 p-1 hover:bg-surface2"
              aria-label="Sumar"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => removeItem(i)}
              className="ml-1 rounded-md p-1 text-muted hover:text-danger"
              aria-label="Quitar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Selector de productos del menú (acordeón por categoría) */}
      <div className="rounded-lg border border-border">
        <div className="border-b border-border p-2">
          <Input
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
            placeholder="Buscar o desplegar categorías…"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {grupos.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted">
              {menu.length === 0 ? "Cargando menú…" : "Sin resultados."}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {grupos.map((g) => {
                const open = estaAbierta(g.categoria);
                return (
                  <div key={g.categoria}>
                    <button
                      type="button"
                      onClick={() => toggle(g.categoria)}
                      className="flex w-full items-center justify-between rounded-md bg-surface2 px-2 py-1.5 text-left text-xs font-bold text-text hover:bg-surface3"
                    >
                      <span>
                        {g.categoria} <span className="text-muted">({g.items.length})</span>
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                      />
                    </button>
                    {open && (
                      <ul className="flex flex-col divide-y divide-border px-1 pt-1">
                        {g.items.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="min-w-0 flex-1 truncate text-sm text-text">
                              {m.nombre}
                            </span>
                            {m.variantes.length > 0 ? (
                              <div className="flex flex-wrap justify-end gap-1">
                                {m.variantes.map((v) => (
                                  <button
                                    key={v.id}
                                    onClick={() => addProducto(m.id, m.nombre, v.label, v.precio)}
                                    className="rounded-md bg-surface3 px-2 py-1 text-xs font-bold hover:bg-surface2"
                                  >
                                    {v.label} · {formatPrecio(v.precio)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button
                                onClick={() => addProducto(m.id, m.nombre, null, m.precio ?? 0)}
                                className="flex items-center gap-1 rounded-md bg-surface3 px-2 py-1 text-xs font-bold hover:bg-surface2"
                              >
                                <Plus className="h-3 w-3" /> {formatPrecio(m.precio ?? 0)}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-muted">Total</span>
        <span className="font-display text-xl text-primary">{formatPrecio(total)}</span>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button loading={saving} onClick={guardar}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

export function OrderEditModal({
  pedido,
  onClose,
  onSave,
}: {
  pedido: Pedido | null;
  onClose: () => void;
  onSave: (patch: SavePatch) => Promise<void>;
}) {
  return (
    <Modal open={!!pedido} onClose={onClose} title={pedido ? `Editar pedido #${pedido.num}` : ""}>
      {pedido && <EditForm key={pedido.id} pedido={pedido} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}
