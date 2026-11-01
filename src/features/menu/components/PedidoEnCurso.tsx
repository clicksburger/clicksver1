"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import {
  esFinal,
  leerUltimoPedido,
  olvidarUltimoPedido,
  pasosSeguimiento,
  type SeguimientoPedido,
} from "@/features/orders/seguimiento";

/** Después de entregado, el aviso sigue 30 minutos por si quieren volver a verlo. */
const MOSTRAR_ENTREGADO_MS = 30 * 60000;

/**
 * Aviso en la carta para volver al seguimiento del último pedido hecho desde
 * este navegador (como las apps de delivery). Se oculta solo cuando el pedido
 * ya se entregó o se rechazó, o si el cliente lo cierra.
 */
export function PedidoEnCurso() {
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);

  useEffect(() => {
    const ultimo = leerUltimoPedido();
    if (!ultimo) return;
    let activo = true;
    fetch(`/api/pedido/${ultimo.id}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return olvidarUltimoPedido();
        if (!response.ok) return;
        const data = (await response.json()) as SeguimientoPedido;
        const cerrado =
          data.estado === "rechazado" ||
          (data.estado === "entregado" &&
            Date.now() - new Date(data.horaEntregado ?? data.creadoEn).getTime() >
              MOSTRAR_ENTREGADO_MS);
        if (cerrado) return olvidarUltimoPedido();
        if (activo) setPedido(data);
      })
      .catch(() => {
        /* Sin conexión: la carta sigue funcionando sin el aviso. */
      });
    return () => {
      activo = false;
    };
  }, []);

  if (!pedido) return null;
  const actual = pasosSeguimiento(pedido).find((paso) => paso.estado === "actual");
  const estado = esFinal(pedido.estado)
    ? pedido.tipo === "delivery"
      ? "Entregado"
      : "Retirado"
    : (actual?.titulo ?? "En curso");
  return (
    <div className="cm-pedido-en-curso" role="status">
      <Link href={`/pedido/${pedido.id}`}>
        <span className="cm-pec-dot" aria-hidden="true" />
        <span className="cm-pec-text">
          <strong>Tu pedido #{pedido.num}</strong>
          <span>
            {estado} {actual?.emoji ?? ""}
          </span>
        </span>
        <span className="cm-pec-cta">
          Seguilo <ChevronRight size={16} />
        </span>
      </Link>
      <button
        type="button"
        aria-label="Ocultar aviso del pedido"
        onClick={() => {
          olvidarUltimoPedido();
          setPedido(null);
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
