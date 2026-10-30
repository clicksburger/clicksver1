"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { updateBranding, uploadLogo } from "@/features/tenants/services/tenants.client";
import { revalidateTenant } from "@/features/tenants/actions";
import type { Tenant } from "@/types/domain";

const CAMPOS_COLOR = [
  ["colorPrimario", "Primario"],
  ["colorFondo", "Fondo"],
  ["colorSurface", "Surface"],
  ["colorTexto", "Texto"],
] as const;

type ColorKey = (typeof CAMPOS_COLOR)[number][0];

export function BrandingForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nombre: tenant.nombre,
    colorPrimario: tenant.colorPrimario,
    colorFondo: tenant.colorFondo,
    colorSurface: tenant.colorSurface,
    colorTexto: tenant.colorTexto,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(tenant.logoUrl);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const setColor = (key: ColorKey, val: string) => setForm((f) => ({ ...f, [key]: val }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await updateBranding(tenant.id, form);
      if (logoFile) await uploadLogo(tenant.id, logoFile);
      await revalidateTenant(tenant.slug);
      setMsg("Guardado ✓");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <FormField label="Nombre del local" htmlFor="b-nombre">
        <Input
          id="b-nombre"
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
        />
      </FormField>

      {CAMPOS_COLOR.map(([key, label]) => (
        <FormField key={key} label={label}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form[key]}
              onChange={(e) => setColor(key, e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
            />
            <Input value={form[key]} onChange={(e) => setColor(key, e.target.value)} />
          </div>
        </FormField>
      ))}

      <FormField label="Logo">
        <div className="flex items-center gap-3">
          {logoPreview && (
            <img src={logoPreview} alt="logo" className="h-16 w-16 rounded object-contain" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setLogoFile(f);
                setLogoPreview(URL.createObjectURL(f));
              }
            }}
            className="text-sm text-muted"
          />
        </div>
      </FormField>

      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button loading={saving} onClick={save}>
        Guardar branding
      </Button>
    </div>
  );
}
