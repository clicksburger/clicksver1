"use client";

import { useEffect } from "react";
import { Printer, X } from "lucide-react";
import { formatPrecio } from "@/lib/format";
import { ESTADO_LABEL } from "@/constants/order-states";
import { ticketSummary } from "../ticket";
import { formatKm, mapsUrl } from "@/features/envios/tarifas";
import type { Pedido } from "@/types/domain";
import "./ticket.css";

const TIPO_LABEL: Record<string, string> = {
  delivery: "ENVÍO A DOMICILIO",
  salon: "SALÓN",
  takeaway: "RETIRO EN EL LOCAL",
};

export function Ticket({
  pedido,
  tenantNombre,
  autoPrint = true,
}: {
  pedido: Pedido;
  tenantNombre: string;
  autoPrint?: boolean;
}) {
  const summary = ticketSummary(pedido);
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [autoPrint, pedido.id]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${tenantNombre} - Pedido #${pedido.num}`;
    return () => {
      document.title = previous;
    };
  }, [pedido.num, tenantNombre]);
  return (
    <main className="ticket-page">
      <nav className="ticket-controls no-print" aria-label="Opciones del comprobante">
        <button type="button" onClick={() => window.print()}>
          <Printer size={18} />
          Imprimir comprobante
        </button>
        <button type="button" onClick={() => window.close()}>
          <X size={18} />
          Cerrar
        </button>
      </nav>
      <p className="ticket-print-hint no-print">
        Formato para papel térmico de 80 mm. En la ventana de impresión seleccioná tu impresora y
        desactivá los encabezados y pies del navegador.
      </p>
      <article className="ticket-paper" aria-label={`Comprobante del pedido ${pedido.num}`}>
        <header>
          <p className="ticket-brand">{tenantNombre}</p>
          <p>Pedidos: 351 873 7099</p>
          <p className="ticket-caption">Comprobante de pedido</p>
          <h1 className="ticket-number">#{pedido.num}</h1>
          <p className="ticket-type">{TIPO_LABEL[pedido.tipo] ?? pedido.tipo}</p>
        </header>
        <section className="ticket-section ticket-meta" aria-label="Fecha y estado">
          <p>
            <strong>Ingresó:</strong> {summary.created}
          </p>
          {summary.confirmed && (
            <p>
              <strong>Confirmado:</strong> {summary.confirmed}
            </p>
          )}
          <p>
            <strong>Estado:</strong> {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
          </p>
          {summary.estimated && (
            <p>
              <strong>Preparación estimada:</strong> {summary.estimated}
            </p>
          )}
          {pedido.demora != null && (
            <p>
              <strong>Demora estimada:</strong> {pedido.demora} min desde la confirmación.
            </p>
          )}
        </section>
        <section className="ticket-section" aria-label="Cliente y entrega">
          <h2>CLIENTE Y ENTREGA</h2>
          <p className="ticket-customer-name">{pedido.nombre || "Cliente no informado"}</p>
          <p>
            <strong>Teléfono:</strong> {pedido.checkout?.telefono || "No informado"}
          </p>
          {summary.delivery ? (
            <>
              <p>
                <strong>Dirección:</strong> {pedido.checkout?.direccion || "No informada"}
              </p>
              {pedido.checkout?.referencia && (
                <p>
                  <strong>Referencia:</strong> {pedido.checkout.referencia}
                </p>
              )}
              {summary.missingAddress && (
                <p className="ticket-warning">
                  Confirmar dirección y contacto con caja antes de despachar.
                </p>
              )}
            </>
          ) : (
            <p>
              {pedido.tipo === "salon" ? "Consumo en el local." : "El cliente retira en el local."}
            </p>
          )}
        </section>
        <table className="ticket-items">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Detalle</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {pedido.items.map((item, index) => (
              <tr key={index}>
                <td>{item.cantidad}×</td>
                <td>
                  <p className="ticket-product-name">{item.nombre}</p>
                  {item.variante && <p className="ticket-variant">{item.variante}</p>}
                  <p className="ticket-unit-price">Unidad: {formatPrecio(item.precio)}</p>
                  {item.obs && <p className="ticket-note">Obs.: {item.obs}</p>}
                </td>
                <td>{formatPrecio(item.precio * item.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="ticket-section" aria-label="Totales y pago">
          <div className="ticket-total">
            <span>Total productos</span>
            <span>{formatPrecio(summary.productsTotal)}</span>
          </div>
          <p className="ticket-small">
            {summary.units} unidades · {pedido.items.length} renglones
          </p>
          {summary.delivery &&
            (summary.envioPendiente ? (
              <p className="ticket-warning">
                Envío a confirmar con el cliente. No está incluido en el total.
              </p>
            ) : (
              <>
                <div className="ticket-total">
                  <span>
                    Envío
                    {summary.envioInfo?.estado === "calculado"
                      ? ` (${formatKm(summary.envioInfo.km)})`
                      : ""}
                  </span>
                  <span>{formatPrecio(summary.envio ?? 0)}</span>
                </div>
                <div className="ticket-total">
                  <span>TOTAL A COBRAR</span>
                  <span>{formatPrecio(summary.total)}</span>
                </div>
              </>
            ))}
          <p>
            <strong>Forma de pago:</strong>{" "}
            {pedido.checkout
              ? pedido.checkout.pago === "efectivo"
                ? "Efectivo"
                : "Transferencia"
              : "No informada"}
          </p>
          <p className="ticket-small">
            Pago pendiente de verificación por caja. Este comprobante no acredita un cobro.
          </p>
        </section>
        {summary.delivery && (
          <section className="ticket-section" aria-label="Completar para reparto">
            <h2>COMPLETAR EN CAJA ANTES DE SALIR</h2>
            {summary.envioPendiente && (
              <>
                <p>Envío acordado: $ __________________</p>
                <p>Total a cobrar: $ __________________</p>
              </>
            )}
            {summary.envioInfo?.lat != null && summary.envioInfo.lng != null && (
              <p className="ticket-small">
                Mapa: {mapsUrl(summary.envioInfo.lat, summary.envioInfo.lng)}
              </p>
            )}
            <p>Repartidor/a: _____________________</p>
          </section>
        )}
        <footer className="ticket-footer">
          <strong>Revisar productos y observaciones antes de entregar.</strong>
          <p>Identificá la bolsa con el pedido #{pedido.num}.</p>
          <p>Gracias por elegir {tenantNombre}.</p>
        </footer>
      </article>
    </main>
  );
}
