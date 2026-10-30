import { createSupabaseBrowserClient } from "@/services/supabase/client";

const BUCKET = "tenant-assets";

/**
 * Sube un archivo al bucket público y devuelve su URL. El path arranca con
 * el tenantId (la RLS de storage permite escribir a usuarios autenticados).
 */
export async function uploadAsset(
  tenantId: string,
  folder: string,
  fileId: string,
  file: File,
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const ext = (file.type.split("/")[1] ?? "bin").replace("jpeg", "jpg");
  const path = `${tenantId}/${folder}/${fileId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // cache-bust para ver el cambio al instante
  return `${data.publicUrl}?v=${Date.now()}`;
}
