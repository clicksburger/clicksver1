"use server";

import { revalidateTag } from "next/cache";
import { tenantTag } from "./services/tenants.service";

/** Invalida la caché del branding del tenant (llamar tras editar branding). */
export async function revalidateTenant(slug: string) {
  revalidateTag(tenantTag(slug));
}
