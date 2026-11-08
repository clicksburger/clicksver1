"use client";

import { ModoCarruselSwitch } from "@/features/menu/components/ModoCarruselSwitch";
import type { CarruselConfig } from "@/features/menu/carrusel";
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
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Tabs, Button, Modal } from "@/components/ui";
import { routes } from "@/constants/routes";
import { horaCorta } from "@/lib/format";
import { useOrders } from "../hooks/useOrders";
import { pedidosPorEstado } from "../store/orders.store";
import { OrderCard } from "./OrderCard";
import { OrderEditModal } from "./OrderEditModal";
import { getTurnoAbierto } from "@/features/caja/services/caja.client";
import { ventasDelTurno } from "@/features/caja/turno-report";
import type { Pedido } from "@/types/domain";

type TabKey = "entrantes" | "preparacion" | "listos" | "entregados" | "rechazados";
const TABS: TabKey[] = ["entrantes", "preparacion", "listos", "entregados", "rechazados"];

const MOTIVOS_RAPIDOS = ["Sin stock", "Fuera de zona", "Local cerrado", "Pedido duplicado"];

/** Confirmación antes de rechazar, con motivo opcional. El pedido NO se borra. */
function RechazarModal({
  pedido,
  onClose,
  onConfirm,
}: {
  pedido: Pedido | null;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  useEffect(() => setMotivo(""), [pedido?.id]);
  return (
    <Modal
      open={pedido != null}
      onClose={onClose}
      title={`¿Rechazar el pedido #${pedido?.num ?? ""}?`}
    >
      <p className="mb-4 text-sm text-muted">
        Al cliente le va a aparecer como rechazado. Si fue una equivocación, lo podés restaurar
        desde la pestaña Rechazados.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {MOTIVOS_RAPIDOS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMotivo(m)}
            className={`rounded-full border px-3 py-1 text-xs ${
              motivo === m ? "border-primary text-primary" : "border-border text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <label className="mb-5 block text-sm">
        <span className="mb-1 block text-muted">Motivo (opcional)</span>
        <input
          value={motivo}
          maxLength={200}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface2 px-3 py-2"
          placeholder="Ej.: sin stock de pan"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={() => onConfirm(motivo)}>
          <X className="h-4 w-4" /> Rechazar pedido
        </Button>
      </div>
    </Modal>
  );
}

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

export function CajaBoard({
  tenantId,
  slug,
  carrusel,
}: {
  tenantId: string;
  slug: string;
  /** Carrusel de la carta: los chicos eligen promo o normal desde acá. */
  carrusel: CarruselConfig;
}) {
  const { pedidos, cambiarEstado, rechazar, restaurar, editar } = useOrders(tenantId);
  const [tab, setTab] = useState<TabKey>("entrantes");
  const [editando, setEditando] = useState<Pedido | null>(null);
  const [rechazando, setRechazando] = useState<Pedido | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const actionLock = useRef(false);
  // Apertura del turno de caja: "Entregados" arranca de cero con cada turno.
  // undefined = cargando; null = caja cerrada.
  const [turnoDesde, setTurnoDesde] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const load = () =>
      getTurnoAbierto(tenantId)
        .then((t) => active && setTurnoDesde(t?.abierto_en ?? null))
        .catch(() => {
          /* se reintenta en el próximo ciclo */
        });
    void load();
    const timer = setInterval(load, 60000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [tenantId]);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("clicks:caja-tab");
      if (TABS.includes(saved as TabKey)) setTab(saved as TabKey);
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
    entregados: turnoDesde ? ventasDelTurno(pedidos, turnoDesde, null).reverse() : [],
    // Rechazados de las últimas 24 h (la ventana que cargan las boards), el último primero.
    rechazados: pedidosPorEstado(pedidos, ["rechazado"]).sort((a, b) =>
      (b.horaRechazado ?? b.creadoEn).localeCompare(a.horaRechazado ?? a.creadoEn),
    ),
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
        <ModoCarruselSwitch tenantId={tenantId} slug={slug} inicial={carrusel} />
        <Link
          href={`${routes.menu(slug)}?mostrador=1`}
          target="_blank"
          title="Abre la carta en modo mostrador: el pedido entra directo, sin WhatsApp"
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
          {
            key: "rechazados",
            label: "Rechazados",
            count: grupos.rechazados.length,
            icon: <Trash2 className="h-[1.1em] w-[1.1em]" aria-hidden="true" />,
            soloIcono: true,
            alFinal: true,
            tono: "danger",
          },
        ]}
      />

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg border border-danger p-4 text-danger">
          {actionError}
        </p>
      )}
      {/* Aviso flotante: siempre montado y fuera del flujo, así no empuja las tarjetas. */}
      <p role="status" aria-live="polite" className={`ops-busy ${busy ? "is-visible" : ""}`}>
        {busy ? "Actualizando pedido…" : ""}
      </p>
      {visibles.length === 0 ? (
        <p className="ops-empty">
          {tab === "listos"
            ? "No hay pedidos listos para entregar."
            : tab === "entregados" && turnoDesde === null
              ? "La caja está cerrada. Los entregados empiezan de cero con cada turno; los anteriores están en Cierre."
              : tab === "entregados"
                ? "Todavía no hay entregas en este turno."
                : tab === "rechazados"
                  ? "No hay pedidos rechazados en las últimas 24 horas."
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
                    onReject={() => setRechazando(p)}
                  />
                </>
              )}
              {p.estado === "rechazado" && (
                <>
                  <p className="w-full text-xs text-danger">
                    Rechazado{p.horaRechazado ? ` a las ${horaCorta(p.horaRechazado)}` : ""}
                    {p.motivoRechazo ? ` · ${p.motivoRechazo}` : ""}
                  </p>
                  <Button size="sm" variant="ghost" onClick={run(() => restaurar(p))}>
                    <RotateCcw className="h-4 w-4" /> Restaurar
                  </Button>
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

      <RechazarModal
        pedido={rechazando}
        onClose={() => setRechazando(null)}
        onConfirm={(motivo) => {
          const p = rechazando;
          setRechazando(null);
          if (p) void run(() => rechazar(p, motivo))();
        }}
      />

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
