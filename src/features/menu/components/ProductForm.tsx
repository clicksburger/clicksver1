"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { Trash2, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import {
  createMenuItem,
  listCategorias,
  setMenuItemImage,
  updateMenuItem,
  uploadProductImage,
  type ProductInput,
  type VariantInput,
} from "../services/menu.client";
import type { Categoria, MenuItem } from "@/types/domain";

export function ProductForm({
  tenantId,
  initial,
  onSaved,
  onCancel,
}: {
  tenantId: string;
  initial: MenuItem | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId ?? "");
  const [hasVariants, setHasVariants] = useState((initial?.variantes.length ?? 0) > 0);
  const [precio, setPrecio] = useState(initial?.precio?.toString() ?? "");
  const [variantes, setVariantes] = useState<VariantInput[]>(
    initial?.variantes.map((v) => ({ label: v.label, precio: v.precio })) ?? [
      { label: "Simple", precio: 0 },
    ],
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imagenUrl ?? null);
  const [destacado, setDestacado] = useState(initial?.destacado ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCategorias(tenantId)
      .then((cs) => {
        setCategorias(cs);
        setCategoriaId((prev) => prev || (cs[0]?.id ?? ""));
      })
      .catch(() => {
        /* el form muestra el aviso de "sin categorías" si falla */
      });
  }, [tenantId]);

  function setVariant(i: number, patch: Partial<VariantInput>) {
    setVariantes((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const cat = categorias.find((c) => c.id === categoriaId);
      if (!cat) throw new Error("Elegí una categoría");

      const payload: ProductInput = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        categoria: cat.nombre,
        categoriaId: cat.id,
        precio: hasVariants ? null : Number(precio) || 0,
        imagenUrl: initial?.imagenUrl ?? null,
        activo: initial?.activo ?? true,
        destacado,
        orden: initial?.orden ?? 0,
        variantes: hasVariants
          ? variantes
              .filter((v) => v.label.trim())
              .map((v) => ({ label: v.label.trim(), precio: Number(v.precio) || 0 }))
          : [],
      };
      if (!payload.nombre) throw new Error("El nombre es obligatorio");

      const id = initial
        ? (await updateMenuItem(tenantId, initial.id, payload), initial.id)
        : await createMenuItem(tenantId, payload);

      if (imageFile) {
        const url = await uploadProductImage(tenantId, id, imageFile);
        await setMenuItemImage(id, url);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField label="Nombre" htmlFor="p-nombre">
        <Input id="p-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </FormField>
      <FormField label="Descripción" htmlFor="p-desc">
        <Input id="p-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </FormField>

      <FormField
        label="Categoría"
        htmlFor="p-cat"
        hint={categorias.length === 0 ? "Creá una categoría en la pestaña Categorías." : undefined}
      >
        <select
          id="p-cat"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          disabled={categorias.length === 0}
          className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">— Elegí una categoría —</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasVariants}
          onChange={(e) => setHasVariants(e.target.checked)}
        />
        Tiene variantes (ej: Simple / Doble / Triple)
      </label>

      {hasVariants ? (
        <div className="flex flex-col gap-2">
          {variantes.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="Etiqueta"
                value={v.label}
                onChange={(e) => setVariant(i, { label: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Precio"
                value={v.precio || ""}
                onChange={(e) => setVariant(i, { precio: Number(e.target.value) })}
                className="w-28"
              />
              <button
                onClick={() => setVariantes((vs) => vs.filter((_, idx) => idx !== i))}
                className="p-1 text-muted hover:text-danger"
                aria-label="Quitar variante"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setVariantes((vs) => [...vs, { label: "", precio: 0 }])}
          >
            <Plus className="h-4 w-4" /> Agregar variante
          </Button>
        </div>
      ) : (
        <FormField label="Precio" htmlFor="p-precio">
          <Input
            id="p-precio"
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </FormField>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface2 p-3">
        <input
          type="checkbox"
          checked={destacado}
          onChange={(e) => setDestacado(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-bold text-text">
            <Star className="h-4 w-4 text-primary" /> Destacar en el menú
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Aparece resaltado en el banner principal del menú público.
          </span>
        </span>
      </label>

      <FormField label="Imagen">
        <div className="flex items-center gap-3">
          {imagePreview && <img src={imagePreview} alt="" className="h-14 w-14 rounded object-cover" />}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setImageFile(f);
                setImagePreview(URL.createObjectURL(f));
              }
            }}
            className="text-sm text-muted"
          />
        </div>
      </FormField>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button loading={saving} onClick={save}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
