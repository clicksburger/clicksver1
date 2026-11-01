"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, MessageCircle, RotateCcw } from "lucide-react";
import { ClicksLogo } from "@/components/ui/ClicksLogo";
import { estaAbierto } from "@/features/tenants/horarios";
import { formatPrecio } from "@/lib/format";
import { ALIAS_TRANSFERENCIA } from "@/constants/business";
import type { HorarioDia } from "@/types/domain";
import {
  esFinal,
  guardarUltimoPedido,
  hora,
  pasosSeguimiento,
  totalSeguimiento,
  ventanaEntrega,
  type SeguimientoPedido as Pedido,
} from "../seguimiento";
import "@/features/menu/components/menu-brand.css";
import "./seguimiento.css";

const CADA_MS = 10000;

/**
 * Seguimiento del pedido para el cliente, al estilo de las apps de delivery:
 * pasos que se completan solos, hora estimada y el detalle de lo que pidió.
 * Consulta el estado cada 10 s (pausa con la pestaña oculta) y deja de
 * consultar cuando el pedido se entrega o se rechaza.
 */
export function SeguimientoPedido({
  inicial,
  horarios,
}: {
  inicial: Pedido;
  horarios: HorarioDia[] | null;
}) {
  const [pedido, setPedido] = useState(inicial);
  const [sinConexion, setSinConexion] = useState(false);
  const [abierto, setAbierto] = useState(true);
  const [recienCambio, setRecienCambio] = useState(false);
  /** Reloj para pasar solo a "En camino a tu casa" aunque no cambie nada en la base. */
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    setAbierto(estaAbierto(horarios));
    // Abrir el link desde WhatsApp también deja el acceso directo en la carta.
    if (!esFinal(inicial.estado)) guardarUltimoPedido(inicial.id, inicial.num);
  }, [horarios, inicial.estado, inicial.id, inicial.num]);

  useEffect(() => {
    if (esFinal(pedido.estado)) return;
    let activo = true;
    async function consultar() {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/pedido/${pedido.id}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const nuevo = (await response.json()) as Pedido;
        if (!activo) return;
        setSinConexion(false);
        setPedido(nuevo);
      } catch {
        if (activo) setSinConexion(true);
      }
    }
    const timer = setInterval(() => void consultar(), CADA_MS);
    const alVolver = () => void consultar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      activo = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [pedido.id, pedido.estado]);

  useEffect(() => {
    if (esFinal(pedido.estado)) return;
    const timer = setInterval(() => setAhora(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [pedido.estado]);

  const pasos = pasosSeguimiento(pedido, ahora);
  const actual = pasos.find((paso) => paso.estado === "actual");
  const pasoActual = actual?.clave ?? pedido.estado;
  const pasoPrevio = useRef(pasoActual);

  // Cambio de paso: lo destaca, vibra en el celular y actualiza la pestaña.
  useEffect(() => {
    if (pasoPrevio.current === pasoActual) return;
    pasoPrevio.current = pasoActual;
    setRecienCambio(true);
    try {
      navigator.vibrate?.(90);
    } catch {
      /* sin vibración */
    }
    const timer = setTimeout(() => setRecienCambio(false), 1800);
    return () => clearTimeout(timer);
  }, [pasoActual]);

  useEffect(() => {
    const titulo =
      pedido.estado === "rechazado"
        ? "No pudimos tomarlo"
        : pedido.estado === "entregado"
          ? "Entregado"
          : (actual?.titulo ?? "Tu pedido");
    document.title = `${titulo} · Pedido #${pedido.num} — Clicks`;
  }, [actual?.titulo, pedido.estado, pedido.num]);

  const delivery = pedido.tipo === "delivery";
  const ventana = ventanaEntrega(pedido);
  const consulta = `https://wa.me/${pedido.whatsapp}?text=${encodeURIComponent(
    `Hola Clicks! Consulto por mi pedido #${pedido.num}.`,
  )}`;

  return (
    <div className="clicks-menu sg">
      <header className="sg-header">
        <Link href="/" aria-label="Volver a la carta de Clicks">
          <ClicksLogo />
        </Link>
        {pedido.nombre && <span className="sg-hola">👋 Hola, {pedido.nombre}</span>}
        <span className={`sg-open ${abierto ? "is-open" : ""}`}>
          <i aria-hidden="true" />
          {abierto ? "Abierto" : "Cerrado"}
        </span>
      </header>

      <main className="sg-card">
        <p className="sg-kicker">Tu pedido</p>
        <h1 className="sg-num">#{pedido.num}</h1>

        {pedido.estado === "rechazado" ? (
          <div className="sg-rechazado" role="status">
            <strong>No pudimos tomar tu pedido</strong>
            <p>Escribinos por WhatsApp y lo resolvemos con vos.</p>
          </div>
        ) : (
          <ol className="sg-steps" aria-label="Estado del pedido">
            {pasos.map((paso) => (
              <li
                key={paso.clave}
                data-estado={paso.estado}
                className={paso.estado === "actual" && recienCambio ? "is-new" : undefined}
                aria-current={paso.estado === "actual" ? "step" : undefined}
              >
                <span className="sg-dot" aria-hidden="true">
                  {paso.estado === "hecho" && <Check size={13} strokeWidth={3.5} />}
                </span>
                <div>
                  <strong>
                    {paso.titulo} {paso.emoji && <span aria-hidden="true">{paso.emoji}</span>}
                  </strong>
                  {paso.detalle && <span>{paso.detalle}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="sr-only" aria-live="polite">
          {pedido.estado === "rechazado" ? "Pedido rechazado" : actual?.titulo}
        </p>

        <div className="sg-eta">
          {pedido.estado === "nuevo" || pedido.estado === "confirmado" ? (
            <>
              <span>⏳ Confirmación</span>
              <p>
                Si todavía no mandaste el mensaje de WhatsApp, envialo para que el local confirme tu
                pedido.
              </p>
            </>
          ) : pedido.estado === "listo" && !delivery ? (
            <>
              <span>🍔 Retiro</span>
              <strong>¡Ya podés pasar a buscarlo!</strong>
            </>
          ) : ventana ? (
            <>
              <span>{delivery ? "🛵 Te llega" : "🍔 Retiralo"}</span>
              <strong>
                {delivery
                  ? `entre las ${ventana.desde} y las ${ventana.hasta}`
                  : `desde las ${ventana.desde}`}
              </strong>
            </>
          ) : pedido.estado === "entregado" && pedido.horaEntregado ? (
            <>
              <span>✅ {delivery ? "Entregado" : "Retirado"}</span>
              <strong>a las {hora(pedido.horaEntregado)}</strong>
            </>
          ) : null}
        </div>

        <ul className="sg-items">
          {pedido.items.map((item, index) => (
            <li key={index}>
              <span>
                {item.cantidad}× {item.nombre}
                {item.variante ? ` (${item.variante})` : ""}
              </span>
              <span>{formatPrecio(item.precio * item.cantidad)}</span>
            </li>
          ))}
          {delivery && (
            <li>
              <span>Envío</span>
              <span>
                {pedido.costoEnvio != null ? formatPrecio(pedido.costoEnvio) : "A confirmar"}
              </span>
            </li>
          )}
          <li className="sg-total">
            <span>
              Total
              {pedido.pago ? ` · ${pedido.pago === "efectivo" ? "efectivo" : "transferencia"}` : ""}
            </span>
            <strong>{formatPrecio(totalSeguimiento(pedido))}</strong>
          </li>
        </ul>
        {pedido.pago === "transferencia" && !esFinal(pedido.estado) && (
          <p className="sg-alias">
            Alias <strong>{ALIAS_TRANSFERENCIA}</strong> · mandá el comprobante por WhatsApp.
          </p>
        )}

        <a className="sg-wa" href={consulta} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={20} /> Consultar por WhatsApp
        </a>
        <Link className="sg-otro" href="/">
          <RotateCcw size={16} /> Hacer otro pedido
        </Link>

        {!esFinal(pedido.estado) && (
          <p className={`sg-live ${sinConexion ? "is-off" : ""}`}>
            <i aria-hidden="true" />
            {sinConexion ? "Sin conexión, reintentando…" : "Se actualiza solo"}
          </p>
        )}
      </main>
    </div>
  );
}
