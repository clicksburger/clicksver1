"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  PackageCheck,
  Minus,
  Plus,
  Pencil,
  UtensilsCrossed,
  Undo2,
  CheckCircle2,
} from "lucide-react";
import { Tabs, Button } from "@/components/ui";
import { routes } from "@/constants/routes";
import { useOrders } from "../hooks/useOrders";
import { pedidosPorEstado } from "../store/orders.store";
import { OrderCard } from "./OrderCard";
import { OrderEditModal } from "./OrderEditModal";
import type { Pedido } from "@/types/domain";

type TabKey = "entrantes" | "preparacion" | "listos" | "entregados";

function ConfirmarNuevo({
  onConfirm,
  onReject,
}: {
  onConfirm: (demora: number) => void;
  onReject: () => void;
}) {
  const [demora, setDemora] = useState(15);
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Demora</span>
        <button
          onClick={() => setDemora((d) => Math.max(5, d - 5))}
          className="rounded-md bg-surface3 p-1 hover:bg-surface2"
          aria-label="Menos demora"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center text-sm font-bold">{demora}m</span>
        <button
          onClick={() => setDemora((d) => d + 5)}
          className="rounded-md bg-surface3 p-1 hover:bg-surface2"
          aria-label="Más demora"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <Button size="sm" onClick={() => onConfirm(demora)}>
        <Check className="h-4 w-4" /> Confirmar
      </Button>
      <Button size="sm" variant="danger" onClick={onReject}>
        <X className="h-4 w-4" /> Rechazar
      </Button>
    </>
  );
}

export function CajaBoard({ tenantId, slug }: { tenantId: string; slug: string }) {
  const { pedidos, cambiarEstado, eliminar, editar } = useOrders(tenantId);
  const [tab, setTab] = useState<TabKey>("entrantes");
  const [editando, setEditando] = useState<Pedido | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionLock = useRef(false);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("clicks:caja-tab");
      if (["entrantes", "preparacion", "listos", "entregados"].includes(saved ?? ""))
        setTab(saved as TabKey);
    } catch {
      /* optional */
    }
  }, []);
  function changeTab(key: string) {
    setTab(key as TabKey);
    try {
      sessionStorage.setItem("clicks:caja-tab", key);
    } catch {
      /* optional */
    }
  }

  const grupos: Record<TabKey, Pedido[]> = {
    entrantes: pedidosPorEstado(pedidos, ["nuevo"]),
    preparacion: pedidosPorEstado(pedidos, ["en_cocina"]),
    listos: pedidosPorEstado(pedidos, ["listo"]),
    entregados: pedidosPorEstado(pedidos, ["entregado"]),
  };
  const visibles = grupos[tab];

  const run = (fn: () => Promise<void>) => async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo actualizar el pedido.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };

  const botonEditar = (p: Pedido) => (
    <Button size="sm" variant="ghost" onClick={() => setEditando(p)}>
      <Pencil className="h-4 w-4" /> Editar
    </Button>
  );

  return (
    <div className="ops-board">
      <div className="ops-board-heading">
        <div>
          <h1>Caja y despacho</h1>
          <p>Confirmá pedidos, coordiná la cocina y entregá los que están listos.</p>
        </div>
        <Link
          href={routes.menu(slug)}
          target="_blank"
          className="ops-load-order inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-bg transition hover:opacity-90"
        >
          <UtensilsCrossed className="h-4 w-4" /> Cargar pedido
        </Link>
      </div>

      <Tabs
        className="mb-6"
        value={tab}
        onChange={changeTab}
        items={[
          { key: "entrantes", label: "Entrantes", count: grupos.entrantes.length },
          { key: "preparacion", label: "En cocina", count: grupos.preparacion.length },
          { key: "listos", label: "Listos", count: grupos.listos.length },
          { key: "entregados", label: "Entregados", count: grupos.entregados.length },
        ]}
      />

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg border border-danger p-4 text-danger">
          {actionError}
        </p>
      )}
      {busy && (
        <p role="status" className="mb-3 text-sm text-muted">
          Actualizando pedido…
        </p>
      )}
      {visibles.length === 0 ? (
        <p className="ops-empty">
          {tab === "listos"
            ? "No hay pedidos listos para entregar."
            : "No hay pedidos en esta sección."}
        </p>
      ) : (
        <fieldset disabled={busy} className="ops-grid" aria-label="Pedidos de la sección">
          {visibles.map((p) => (
            <OrderCard key={p.id} pedido={p} printHref={routes.ticket(slug, p.num)}>
              {p.estado === "nuevo" && (
                <>
                  {botonEditar(p)}
                  <ConfirmarNuevo
                    onConfirm={(demora) => run(() => cambiarEstado(p, "en_cocina", { demora }))()}
                    onReject={run(() => eliminar(p))}
                  />
                </>
              )}
              {p.estado === "en_cocina" && (
                <>
                  {botonEditar(p)}
                  <Button size="sm" onClick={run(() => cambiarEstado(p, "listo"))}>
                    <CheckCircle2 className="h-4 w-4" /> Listo
                  </Button>
                </>
              )}
              {p.estado === "listo" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={run(() => cambiarEstado(p, "en_cocina"))}
                  >
                    <Undo2 className="h-4 w-4" /> Reabrir
                  </Button>
                  <Button size="sm" onClick={run(() => cambiarEstado(p, "entregado"))}>
                    <PackageCheck className="h-4 w-4" /> Entregar
                  </Button>
                </>
              )}
            </OrderCard>
          ))}
        </fieldset>
      )}

      <OrderEditModal
        pedido={editando}
        onClose={() => setEditando(null)}
        onSave={async (patch) => {
          if (editando) await editar(editando, patch);
        }}
      />
    </div>
  );
}
