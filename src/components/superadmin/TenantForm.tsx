"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { createTenant, updateTenant } from "@/features/tenants/services/superadmin.client";
import type { Tenant } from "@/types/domain";

export function TenantForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Tenant | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [colorPrimario, setColorPrimario] = useState(initial?.colorPrimario ?? "#F5A300");
  const [colorFondo, setColorFondo] = useState(initial?.colorFondo ?? "#0f0f0f");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!nombre.trim()) throw new Error("El nombre es obligatorio");
      if (initial) {
        await updateTenant(initial.id, { nombre, colorPrimario, colorFondo });
      } else {
        if (!slug.trim()) throw new Error("El slug es obligatorio");
        await createTenant({ slug, nombre, colorPrimario, colorFondo });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {!initial && (
        <FormField label="Slug (URL)" htmlFor="t-slug" hint="Ej: clicks-burger → /t/clicks-burger">
          <Input id="t-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mi-local" />
        </FormField>
      )}
      <FormField label="Nombre" htmlFor="t-nombre">
        <Input id="t-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </FormField>
      <div className="flex gap-4">
        <FormField label="Color primario">
          <input
            type="color"
            value={colorPrimario}
            onChange={(e) => setColorPrimario(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent"
          />
        </FormField>
        <FormField label="Color fondo">
          <input
            type="color"
            value={colorFondo}
            onChange={(e) => setColorFondo(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent"
          />
        </FormField>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button loading={saving} onClick={save}>
          {initial ? "Guardar" : "Crear"}
        </Button>
      </div>
    </div>
  );
}
