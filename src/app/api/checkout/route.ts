import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/services/supabase/admin";
import { BUSINESS_SLUG } from "@/constants/business";
import {
  checkoutSchema,
  priceCheckout,
  attachCheckout,
  readCheckout,
  whatsappMessage,
} from "@/features/orders/checkout";
import { mapMenu } from "@/features/menu/mappers";
import { mapTenant } from "@/features/tenants/mappers";
import { estaAbierto } from "@/features/tenants/horarios";
import type { CheckoutDetails, PedidoItem } from "@/types/domain";
import type { Json } from "@/types/db.types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const respondError = (message: string, status = 400) =>
    NextResponse.json({ error: message }, { status });
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return respondError("Origen no permitido.", 403);
    const text = await request.text();
    if (text.length > 40000) return respondError("El pedido es demasiado grande.", 413);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return respondError("El pedido no tiene un formato válido.");
    }
    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success)
      return respondError(parsed.error.issues[0]?.message ?? "Revisá los datos del pedido.");
    const input = parsed.data;
    const db = createSupabaseAdminClient();
    const { data: tenant, error: tenantError } = await db
      .from("tenants")
      .select("*")
      .eq("slug", BUSINESS_SLUG)
      .eq("activo", true)
      .single();
    if (tenantError || !tenant)
      return respondError("No se pudo consultar el local. Intentá nuevamente.", 503);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const responseFor = (
      num: number,
      nombre: string,
      tipo: string,
      items: PedidoItem[],
      checkout: CheckoutDetails,
    ) => {
      const phone = (process.env.CLICKS_WHATSAPP_NUMBER ?? "543518737099").replace(/\D/g, "");
      return NextResponse.json(
        {
          num,
          total: items.reduce((sum, item) => sum + item.precio * item.cantidad, 0),
          whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage(num, nombre, tipo, items, checkout))}`,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    };
    const findExisting = async () => {
      const result = await db
        .from("pedidos")
        .select("num,nombre,tipo,items")
        .eq("id", input.requestId)
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return null;
      const items = result.data.items as unknown as PedidoItem[];
      const checkout = readCheckout(items);
      if (!checkout || checkout.requestHash !== requestHash)
        return NextResponse.json(
          {
            error:
              "Este intento ya tiene un pedido guardado con otros datos. Revisá el pedido antes de iniciar uno nuevo.",
            alreadySaved: true,
          },
          { status: 409 },
        );
      return responseFor(
        result.data.num,
        result.data.nombre ?? input.nombre,
        result.data.tipo,
        items,
        checkout,
      );
    };
    const existing = await findExisting();
    if (existing) return existing;
    if (!estaAbierto(mapTenant(tenant).horarios))
      return respondError("El local está cerrado. Podés pedir cuando vuelva a abrir.", 409);
    const [products, variants, categories] = await Promise.all([
      db.from("menu_items").select("*").eq("tenant_id", tenant.id).eq("activo", true),
      db.from("menu_variants").select("*").eq("tenant_id", tenant.id).order("orden"),
      db.from("categorias").select("*").eq("tenant_id", tenant.id),
    ]);
    if (products.error || variants.error || categories.error)
      return respondError("No se pudo verificar la carta. Intentá nuevamente.", 503);
    let priced: PedidoItem[];
    try {
      priced = priceCheckout(
        input,
        mapMenu(products.data ?? [], variants.data ?? [], categories.data ?? []),
      );
    } catch (error) {
      return respondError(error instanceof Error ? error.message : "Revisá el carrito.", 409);
    }
    const checkout: CheckoutDetails = {
      version: 1,
      telefono: input.telefono,
      direccion: input.tipo === "delivery" ? input.direccion : null,
      referencia: input.tipo === "delivery" ? input.referencia || null : null,
      pago: input.pago,
      requestHash,
    };
    const verifiedTotal = priced.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    if (Math.abs(verifiedTotal - input.expectedTotal) > 0.005)
      return respondError(
        "La carta cambió de precio. Cerrá este paso, actualizá el menú y revisá el total antes de confirmar.",
        409,
      );
    const items = attachCheckout(priced, checkout);
    // UUID estable evita pedidos duplicados en reintentos. La restricción (tenant_id,num)
    // resuelve colisiones de numeración con otros dispositivos o con la RPC existente.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { data: last, error: lastError } = await db
        .from("pedidos")
        .select("num")
        .eq("tenant_id", tenant.id)
        .order("num", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastError) throw lastError;
      const num = (last?.num ?? 0) + 1;
      const { error } = await db.from("pedidos").insert({
        id: input.requestId,
        tenant_id: tenant.id,
        num,
        nombre: input.nombre,
        tipo: input.tipo,
        estado: "nuevo",
        items: items as unknown as Json,
      });
      if (!error) return responseFor(num, input.nombre, input.tipo, items, checkout);
      if (error.code !== "23505") throw error;
      const duplicate = await findExisting();
      if (duplicate) return duplicate;
    }
    return respondError(
      "Hay varios pedidos entrando. Reintentá para recuperar o guardar el tuyo.",
      503,
    );
  } catch {
    return respondError(
      "No se pudo confirmar el registro. Reintentá con los mismos datos; no se duplicará el pedido.",
      503,
    );
  }
}
