"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPrecio } from "@/lib/format";
import { useCartStore, cartTotal, cartToPedidoItems } from "../store/cart.store";
import { CheckoutForm, type CheckoutAttempt } from "./CheckoutForm";
import type { Tenant, PedidoItem } from "@/types/domain";

const stepperBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-text transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40";

export function CartPanel({
  tenant,
  cerrado = false,
  showTitle = true,
}: {
  tenant: Tenant;
  cerrado?: boolean;
  showTitle?: boolean;
}) {
  const lines = useCartStore((state) => state.lines);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const remove = useCartStore((state) => state.remove);
  const clear = useCartStore((state) => state.clear);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PedidoItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const attemptData = useRef<CheckoutAttempt>({});
  const [saving, setSaving] = useState(false);
  const total = cartTotal(lines);
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
      {showTitle && <h2 className="font-display text-xl tracking-wide text-text">Tu pedido</h2>}
      {!lines.length ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ShoppingBag className="h-8 w-8 text-muted" aria-hidden="true" />
          <p className="text-sm text-muted">Todavía no agregaste nada.</p>
        </div>
      ) : (
        <>
          <ul className="-mr-1 flex max-h-[42vh] flex-col divide-y divide-border overflow-y-auto pr-1 lg:max-h-[48vh]">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text">
                    {line.nombre}
                    {line.variante && <span className="text-muted"> · {line.variante}</span>}
                  </p>
                  <p className="text-xs text-muted">{formatPrecio(line.precio * line.cantidad)}</p>
                  {line.obs && (
                    <p className="mt-1 break-words text-xs italic text-muted">{line.obs}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => decrement(line.key)}
                    className={cn(stepperBtn, "bg-surface3")}
                    aria-label={`Restar uno de ${line.nombre}`}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{line.cantidad}</span>
                  <button
                    type="button"
                    onClick={() => increment(line.key)}
                    className={cn(stepperBtn, "bg-surface3")}
                    aria-label={`Sumar uno de ${line.nombre}`}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    className={stepperBtn}
                    aria-label={`Quitar ${line.nombre}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border pt-3">
            <span className="text-muted">Total de productos</span>
            <strong className="font-display text-2xl text-primary">{formatPrecio(total)}</strong>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            En el siguiente paso elegís entrega y pago. El pedido llega al sistema de{" "}
            {tenant.nombre} y podés enviarlo por WhatsApp.
          </p>
          {cerrado && <p className="text-sm text-danger">El local está cerrado.</p>}
          <button
            type="button"
            disabled={cerrado}
            onClick={() => {
              if (!attemptData.current.body || attemptData.current.receipt) {
                attemptData.current = {};
                setSnapshot(cartToPedidoItems(lines));
              }
              setAttempt((value) => value + 1);
              setCheckoutOpen(true);
            }}
            className="rounded-xl bg-primary px-4 py-3 font-bold text-bg disabled:opacity-50"
          >
            Continuar con el pedido
          </button>
        </>
      )}
      {!lines.length && attemptData.current.receipt && (
        <button
          type="button"
          onClick={() => setCheckoutOpen(true)}
          className="text-sm text-primary underline"
        >
          Ver pedido guardado y abrir WhatsApp
        </button>
      )}
      {checkoutOpen &&
        createPortal(
          <Modal
            open={checkoutOpen}
            onClose={() => {
              if (!saving) setCheckoutOpen(false);
            }}
            title="Completá tu pedido"
            className="cm-checkout max-w-xl"
            backdropClassName="cm-modal-backdrop"
          >
            <CheckoutForm
              key={attempt}
              items={snapshot}
              cerrado={cerrado}
              onSaved={clear}
              attempt={attemptData.current}
              onSubmitting={setSaving}
            />
          </Modal>,
          document.body,
        )}
    </div>
  );
}
