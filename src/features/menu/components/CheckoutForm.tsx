"use client";

import { useRef, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { formatPrecio } from "@/lib/format";
import type { PedidoItem } from "@/types/domain";

interface Receipt {
  num: number;
  total: number;
  whatsappUrl: string;
}
export interface CheckoutAttempt {
  requestId?: string;
  body?: string;
  receipt?: Receipt;
}

export function CheckoutForm({
  items,
  cerrado,
  onSaved,
  attempt,
  onSubmitting,
}: {
  items: PedidoItem[];
  cerrado: boolean;
  onSaved: () => void;
  attempt: CheckoutAttempt;
  onSubmitting: (saving: boolean) => void;
}) {
  const previous = attempt.body
    ? (JSON.parse(attempt.body) as {
        nombre: string;
        telefono: string;
        tipo: "takeaway" | "delivery";
        direccion: string;
        referencia: string;
        pago: string;
      })
    : null;
  const [tipo, setTipo] = useState<"takeaway" | "delivery">(previous?.tipo ?? "takeaway");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(attempt.receipt ?? null);
  const requestId = useRef<string | null>(attempt.requestId ?? null);
  const busy = useRef(false);
  const pendingBody = useRef<string | null>(attempt.body ?? null);
  const [locked, setLocked] = useState(!!attempt.body);
  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || receipt || cerrado) return;
    const form = new FormData(event.currentTarget);
    if (!pendingBody.current) {
      requestId.current ??= crypto.randomUUID();
      pendingBody.current = JSON.stringify({
        expectedTotal: total,
        requestId: requestId.current,
        nombre: form.get("nombre"),
        telefono: form.get("telefono"),
        tipo,
        direccion: form.get("direccion") ?? "",
        referencia: form.get("referencia") ?? "",
        pago: form.get("pago"),
        items: items.map(({ itemId, variante, cantidad, obs }) => ({
          itemId,
          variante,
          cantidad,
          obs,
        })),
      });
      attempt.requestId = requestId.current;
      attempt.body = pendingBody.current;
    }
    busy.current = true;
    setLoading(true);
    onSubmitting(true);
    setLocked(true);
    setError(null);
    // Abrir en el gesto del usuario evita bloqueos de pop-ups después del guardado.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingBody.current,
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) {
        // 400 y 409 son errores determinados antes de guardar; permiten corregir.
        if (response.status === 400 || (response.status === 409 && !result.alreadySaved)) {
          pendingBody.current = null;
          delete attempt.body;
          setLocked(false);
        }
        throw new Error(result.error || "No se pudo registrar el pedido.");
      }
      const saved = result as Receipt;
      attempt.receipt = saved;
      setReceipt(saved);
      onSaved();
      if (popup && !popup.closed) popup.location.href = saved.whatsappUrl;
    } catch (cause) {
      popup?.close();
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo confirmar el registro. Reintentá para recuperar el pedido.",
      );
    } finally {
      busy.current = false;
      setLoading(false);
      onSubmitting(false);
    }
  }

  if (receipt)
    return (
      <div className="flex flex-col items-center gap-4 py-3 text-center" role="status">
        <CheckCircle2 size={42} className="text-primary" />
        <h3 className="text-xl font-bold">Pedido #{receipt.num} guardado</h3>
        <p className="text-sm leading-relaxed text-muted">
          Ya aparece en el sistema del local. En WhatsApp, revisá el resumen y pulsá Enviar para
          completar el mensaje.
        </p>
        <p className="font-display text-2xl text-primary">{formatPrecio(receipt.total)}</p>
        <a
          href={receipt.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-bg"
        >
          <MessageCircle size={20} /> Abrir WhatsApp
        </a>
        <p className="text-xs text-muted">
          Si WhatsApp no se abrió, usá este botón. Abrirlo otra vez no crea otro pedido. Esperá la
          confirmación del local.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-sm text-muted">Completá tus datos para coordinar tu pedido con Clicks.</p>
      <details className="rounded-xl border border-border p-3 text-sm">
        <summary className="cursor-pointer font-bold">
          Resumen de productos ({items.reduce((count, item) => count + item.cantidad, 0)})
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-xs text-muted">
          {items.map((item, index) => (
            <li key={index}>
              {item.cantidad} × {item.nombre}
              {item.variante ? ` · ${item.variante}` : ""}
              {item.obs ? ` · ${item.obs}` : ""}
            </li>
          ))}
        </ul>
      </details>
      {locked && !loading && (
        <p className="text-sm text-muted">
          Conservamos el intento anterior y sus datos para evitar pedidos duplicados.
        </p>
      )}
      <fieldset disabled={loading || locked} className="flex flex-col gap-5 disabled:opacity-75">
        <label className="flex flex-col gap-2 text-sm font-bold">
          Nombre y apellido *
          <input
            name="nombre"
            defaultValue={previous?.nombre}
            required
            minLength={3}
            maxLength={100}
            autoComplete="name"
            placeholder="Necesitamos saber cómo te llamás"
            className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-bold">
          Teléfono *
          <input
            name="telefono"
            defaultValue={previous?.telefono}
            required
            type="tel"
            minLength={8}
            maxLength={30}
            autoComplete="tel"
            placeholder="Un número para contactarte"
            className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <fieldset className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-bold">Forma de entrega *</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "takeaway", label: "Lo retiro personalmente" },
              { value: "delivery", label: "Necesito que me lo envíen" },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${tipo === option.value ? "border-primary bg-surface3" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={option.value}
                  checked={tipo === option.value}
                  onChange={() => setTipo(option.value as typeof tipo)}
                  className="accent-[#ffd21c]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {tipo === "delivery" && (
          <>
            <label className="flex flex-col gap-2 text-sm font-bold">
              Dirección de entrega *
              <input
                name="direccion"
                defaultValue={previous?.direccion}
                required
                minLength={5}
                maxLength={240}
                autoComplete="street-address"
                placeholder="Calle, número, barrio y localidad"
                className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-bold">
              Piso, departamento o referencia
              <input
                name="referencia"
                defaultValue={previous?.referencia}
                maxLength={150}
                placeholder="Opcional"
                className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <p className="text-xs leading-relaxed text-muted">
              El costo y la disponibilidad del envío se confirman según la dirección. No están
              incluidos en el total de productos.
            </p>
          </>
        )}
        <fieldset className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-bold">Forma de pago *</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "efectivo", label: "Efectivo" },
              { value: "transferencia", label: "Transferencia" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="pago"
                  value={option.value}
                  defaultChecked={previous?.pago === option.value}
                  required
                  className="accent-[#ffd21c]"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">El local te indicará cómo completar el pago.</p>
        </fieldset>
      </fieldset>
      <div className="flex justify-between border-t border-border pt-4">
        <span>Total de productos</span>
        <strong className="font-display text-2xl text-primary">{formatPrecio(total)}</strong>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {cerrado && <p className="text-sm text-danger">El local está cerrado en este momento.</p>}
      <button
        type="submit"
        disabled={loading || cerrado}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-bg disabled:opacity-50"
      >
        <MessageCircle size={20} />
        {loading
          ? "Guardando pedido…"
          : locked
            ? "Reintentar y abrir WhatsApp"
            : "Confirmar y pedir por WhatsApp"}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        Tu pedido quedará registrado en el local. En WhatsApp, revisá el mensaje y pulsá Enviar.
      </p>
    </form>
  );
}
