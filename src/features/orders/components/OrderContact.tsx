import type { CheckoutDetails } from "@/types/domain";
import { MOTIVO_A_CONFIRMAR, formatKm, mapsUrl } from "@/features/envios/tarifas";

export function OrderContact({
  checkout,
  costoEnvio = null,
}: {
  checkout?: CheckoutDetails;
  costoEnvio?: number | null;
}) {
  if (!checkout) return null;
  return (
    <div className="ops-contact flex flex-col gap-1 border-t border-border pt-2 text-xs leading-relaxed">
      <p>
        Teléfono:{" "}
        <a className="underline" href={`tel:${checkout.telefono}`}>
          {checkout.telefono}
        </a>
      </p>
      {checkout.direccion && (
        <p className="break-words">
          Entrega: {checkout.direccion}
          {checkout.referencia ? ` · ${checkout.referencia}` : ""}
        </p>
      )}
      <p>
        Pago: {checkout.pago === "efectivo" ? "Efectivo" : "Transferencia"} · pendiente de verificar
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
