"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Input } from "@/components/forms";
import { revalidateMenu } from "../actions";
import {
  createCategoria,
  deleteCategoria,
  listCategorias,
  renameCategoria,
  setCategoriaOrden,
} from "../services/menu.client";
import type { Categoria } from "@/types/domain";

export function CategoriesManager({ tenantId }: { tenantId: string }) {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      setCats(await listCategorias(tenantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        await revalidateMenu(tenantId);
        await recargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setBusy(false);
      }
    },
    [tenantId, recargar],
  );

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    await run(async () => {
      await createCategoria(tenantId, nombre, cats.length);
      setNuevo("");
    });
  }

  async function guardarNombre(id: string) {
    const nombre = editNombre.trim();
    if (!nombre) return;
    await run(async () => {
      await renameCategoria(id, nombre);
      setEditId(null);
    });
  }

  async function mover(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    const a = cats[idx];
    const b = cats[j];
    if (!a || !b) return;
    await run(async () => {
      await setCategoriaOrden(a.id, b.orden);
      await setCategoriaOrden(b.id, a.orden);
    });
  }

  async function borrar(c: Categoria) {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    await run(() => deleteCategoria(c.id));
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-muted">Cargando…</p>
      ) : cats.length === 0 ? (
        <p className="text-muted">Todavía no hay categorías. Creá la primera abajo.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {cats.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <button
                  onClick={() => mover(i, -1)}
                  disabled={busy || i === 0}
                  className="text-muted hover:text-primary disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => mover(i, 1)}
                  disabled={busy || i === cats.length - 1}
                  className="text-muted hover:text-primary disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {editId === c.id ? (
                <>
                  <Input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="flex-1"
                  />
                  <button
                    onClick={() => guardarNombre(c.id)}
                    disabled={busy}
                    className="p-1 text-muted hover:text-success"
                    aria-label="Guardar"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="p-1 text-muted hover:text-danger"
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-bold text-text">{c.nombre}</span>
                  <button
                    onClick={() => {
                      setEditId(c.id);
                      setEditNombre(c.nombre);
                    }}
                    className="p-1 text-muted hover:text-primary"
                    aria-label="Renombrar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => borrar(c)}
                    disabled={busy}
                    className="p-1 text-muted hover:text-danger"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder="Nueva categoría"
          onKeyDown={(e) => {
            if (e.key === "Enter") void agregar();
          }}
        />
        <Button onClick={agregar} loading={busy}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>
    </div>
  );
}
