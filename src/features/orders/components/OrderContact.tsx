"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import type { CheckoutDetails } from "@/types/domain";
import { MOTIVO_A_CONFIRMAR, formatKm, mapsUrl } from "@/features/envios/tarifas";
import { verComprobante } from "../comprobante.actions";

/** Abre el comprobante con un link temporal (la pestaña se abre antes para que no la bloqueen). */
function VerComprobante({ tenantId, pedidoId }: { tenantId: string; pedidoId: string }) {
  const [estado, setEstado] = useState<"idle" | "abriendo" | "error">("idle");
  async function abrir() {
    const ventana = window.open("about:blank", "_blank");
    setEstado("abriendo");
    try {
      const url = await verComprobante(tenantId, pedidoId);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
      setEstado("idle");
    } catch {
      ventana?.close();
      setEstado("error");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void abrir()}
      disabled={estado === "abriendo"}
      className="inline-flex items-center gap-1 font-bold text-primary underline disabled:opacity-60"
    >
      <Paperclip className="h-3.5 w-3.5" />
      {estado === "abriendo"
        ? "Abriendo…"
        : estado === "error"
          ? "No se pudo abrir: reintentar"
          : "Ver comprobante"}
    </button>
  );
}

export function OrderContact({
  checkout,
  costoEnvio = null,
  pedidoId,
  tenantId,
}: {
  checkout?: CheckoutDetails;
  costoEnvio?: number | null;
  pedidoId?: string;
  tenantId?: string;
}) {
  if (!checkout) return null;
  return (
    <div className="ops-contact flex flex-col gap-1 border-t border-border pt-2 text-xs leading-relaxed">
      {checkout.origen === "mostrador" && (
        <p className="font-bold text-primary">Cargado en el mostrador · sin WhatsApp</p>
      )}
      {checkout.telefono && (
        <p>
          Teléfono:{" "}
          <a className="underline" href={`tel:${checkout.telefono}`}>
            {checkout.telefono}
          </a>
        </p>
      )}
      {checkout.direccion && (
        <p className="break-words">
          Entrega: {checkout.direccion}
          {checkout.referencia ? ` · ${checkout.referencia}` : ""}
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-2">
        <span>
          Pago: {checkout.pago === "efectivo" ? "Efectivo" : "Transferencia"} ·{" "}
          {checkout.comprobante ? "comprobante adjunto" : "pendiente de verificar"}
        </span>
        {checkout.comprobante && pedidoId && tenantId && (
          <VerComprobante tenantId={tenantId} pedidoId={pedidoId} />
        )}
      </p>
      {checkout.envio?.lat != null && checkout.envio.lng != null && (
        <p>
          <a
            className="underline"
            href={mapsUrl(checkout.envio.lat, checkout.envio.lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en Google Maps
          </a>
          {checkout.envio.km != null ? ` · ${formatKm(checkout.envio.km)}` : ""}
        </p>
      )}
      {checkout.direccion && costoEnvio == null && (
        <p>
          Envío a confirmar con el cliente
          {checkout.envio?.estado === "a_confirmar"
            ? `: ${MOTIVO_A_CONFIRMAR[checkout.envio.motivo].toLowerCase()}`
            : "."}{" "}
          Cargalo con Editar.
        </p>
      )}
    </div>
  );
}
