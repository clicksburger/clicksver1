"use client";
import { useEffect, useState } from "react";
import { Tabs } from "@/components/ui";

import { useOrders } from "../hooks/useOrders";
import { pedidosPorEstado } from "../store/orders.store";
import { KitchenOrderCard } from "./KitchenOrderCard";

/**
 * Panel de Cocina para TV: SOLO LECTURA, muestra preparación o listos para
 * entregar, en una grilla que se auto-ajusta al ancho de la pantalla.
 * Se actualiza solo vía Realtime; no cambia estados (eso lo maneja Caja y la
 * RLS lo refuerza). El parámetro slug se mantiene por compatibilidad de la ruta.
 */
export function CocinaBoard({ tenantId }: { tenantId: string; slug: string }) {
  const { pedidos } = useOrders(tenantId);
  const enCocina = pedidosPorEstado(pedidos, ["en_cocina"]);
  const listos = pedidosPorEstado(pedidos, ["listo"]);
  const [view, setView] = useState("preparacion");
  useEffect(() => {
    try {
      if (sessionStorage.getItem("clicks:cocina-view") === "listos") setView("listos");
    } catch {
      /* optional */
    }
  }, []);
  const visible = view === "listos" ? listos : enCocina;
  function changeView(key: string) {
    setView(key);
    try {
      sessionStorage.setItem("clicks:cocina-view", key);
    } catch {
      /* optional */
    }
  }

  return (
    <div className="ops-board">
      <div className="ops-board-heading">
        <div>
          <h1>Cocina</h1>
          <p>La confirmación y la entrega se gestionan desde caja.</p>
        </div>
        <span className="rounded-lg border border-border px-4 py-2 text-sm font-bold">
          {enCocina.length} en preparación · {listos.length} listos
        </span>
      </div>
      <Tabs
        className="mb-6"
        value={view}
        onChange={changeView}
        items={[
          { key: "preparacion", label: "En preparación", count: enCocina.length },
          { key: "listos", label: "Listos para entregar", count: listos.length },
        ]}
      />
      {visible.length === 0 ? (
        <p className="ops-empty">
          {view === "listos"
            ? "No hay pedidos listos para entregar."
            : "No hay pedidos en preparación."}
        </p>
      ) : (
        <div className="ops-grid">
          {visible.map((p) => (
            <KitchenOrderCard key={p.id} pedido={p} />
          ))}
        </div>
      )}
    </div>
  );
}
