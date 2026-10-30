import { createSupabaseBrowserClient } from "@/services/supabase/client";
import { uploadAsset } from "./storage.client";
import { horariosToJson } from "../horarios";
import type { HorarioDia } from "@/types/domain";

export interface BrandingInput {
  nombre: string;
  colorPrimario: string;
  colorFondo: string;
  colorSurface: string;
  colorTexto: string;
}

export async function updateBranding(tenantId: string, input: BrandingInput): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      nombre: input.nombre,
      color_primario: input.colorPrimario,
      color_fondo: input.colorFondo,
      color_surface: input.colorSurface,
      color_texto: input.colorTexto,
    })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
}

export async function uploadLogo(tenantId: string, file: File): Promise<string> {
  const url = await uploadAsset(tenantId, "logo", "logo", file);
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("tenants").update({ logo_url: url }).eq("id", tenantId);
  if (error) throw new Error(error.message);
  return url;
}

export async function updateHorarios(tenantId: string, horarios: HorarioDia[]): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("tenants")
    .update({ horarios: horariosToJson(horarios) })
    .eq("id", tenantId);
  if (error) throw new Error(error.message);
}
