import type { CheckoutDetails } from "@/types/domain";

export function OrderContact({ checkout }: { checkout?: CheckoutDetails }) {
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
      {checkout.direccion && <p>Envío a confirmar; no incluido en productos.</p>}
    </div>
  );
}
