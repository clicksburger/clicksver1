"use server";

import { revalidateTag } from "next/cache";
import { menuTag } from "./services/menu.service";

/** Invalida la caché del menú del tenant (llamar tras editar productos). */
export async function revalidateMenu(tenantId: string) {
  revalidateTag(menuTag(tenantId));
}
