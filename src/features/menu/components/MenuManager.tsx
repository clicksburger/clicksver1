"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Modal, Badge } from "@/components/ui";
import { formatPrecio } from "@/lib/format";
import { fetchMenuAll, deleteMenuItem, setMenuItemActivo } from "../services/menu.client";
import { revalidateMenu } from "../actions";
import { groupByCategoria } from "../mappers";
import { ProductForm } from "./ProductForm";
import type { MenuItem } from "@/types/domain";

export function MenuManager({ tenantId }: { tenantId: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const recargar = useCallback(() => {
    setLoading(true);
    fetchMenuAll(tenantId)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => recargar(), [recargar]);

  function nuevo() {
    setEditing(null);
    setOpen(true);
  }
  function editar(item: MenuItem) {
    setEditing(item);
    setOpen(true);
  }
  async function eliminar(item: MenuItem) {
    if (!confirm(`¿Eliminar "${item.nombre}"?`)) return;
    await deleteMenuItem(item.id);
    await revalidateMenu(tenantId);
    recargar();
  }
  async function toggle(item: MenuItem) {
    await setMenuItemActivo(item.id, !item.activo);
    await revalidateMenu(tenantId);
    recargar();
  }

  const grupos = groupByCategoria(items);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={nuevo}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      {loading ? (
        <p className="text-muted">Cargando menú…</p>
      ) : (
        grupos.map((g) => (
          <section key={g.categoria} className="flex flex-col gap-2">
            <h3 className="font-display text-lg tracking-wide text-text">{g.categoria}</h3>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
              {g.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 p-3">
                  {item.imagenUrl ? (
                    <img src={item.imagenUrl} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-surface3" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-text">{item.nombre}</p>
                    <p className="text-xs text-muted">
                      {item.variantes.length > 0
                        ? item.variantes.map((v) => `${v.label} ${formatPrecio(v.precio)}`).join(" · ")
                        : formatPrecio(item.precio)}
                    </p>
                  </div>
                  {!item.activo && <Badge tone="neutral">Inactivo</Badge>}
                  <button
                    onClick={() => toggle(item)}
                    className="text-xs text-muted underline hover:text-text"
                  >
                    {item.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => editar(item)} className="p-1 text-muted hover:text-primary" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => eliminar(item)} className="p-1 text-muted hover:text-danger" aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar producto" : "Nuevo producto"}>
        <ProductForm
          tenantId={tenantId}
          initial={editing}
          onCancel={() => setOpen(false)}
          onSaved={async () => {
            await revalidateMenu(tenantId);
            setOpen(false);
            recargar();
          }}
        />
      </Modal>
    </div>
  );
}
