"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChefHat,
  Download,
  Package,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { loadDashboard, loadShiftDashboard } from "@/features/dashboard/dashboard.client";
import { money, orderTotal, periodStart, summarize } from "@/features/dashboard/summary";
import { envioDe } from "@/features/envios/tarifas";
import { ESTADO_LABEL } from "@/constants/order-states";
import { routes } from "@/constants/routes";
import type { Tenant } from "@/types/domain";
import { Sk } from "@/components/ui/Skeleton";
import "./dashboard.css";

type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
const time = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

export function ClicksDashboard({ tenant }: { tenant: Tenant }) {
  // 0 = turno de caja (se reinicia en cada apertura); 7 y 30 = días calendario.
  const [days, setDays] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  /** Período al que corresponden los datos en pantalla (se conservan al refrescar). */
  const [dataDays, setDataDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true);
      setError(null);
      try {
        const result =
          days === 0
            ? await loadShiftDashboard(tenant.id)
            : await loadDashboard(tenant.id, periodStart(days), new Date().toISOString());
        if (active) {
          setData(result);
          setDataDays(days);
          setUpdated(new Date().toISOString());
        }
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "No se pudo actualizar el resumen.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    // Con la pestaña oculta no consulta; al volver, actualiza en el momento.
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tenant.id, days, revision]);

  const summary = useMemo(() => summarize(data?.orders ?? []), [data]);
  // Skeleton solo sin datos del período elegido: los refrescos mantienen lo que se ve.
  const current = data && dataDays === days ? data : null;
  const showSkeleton = !current && (loading || !error);
  function exportSales() {
    // Los textos se entrecomillan y neutralizan para evitar fórmulas al abrir el CSV.
    const cell = (value: string | number) =>
      `"${String(value)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      ["Pedido", "Fecha de creación", "Cliente", "Modalidad", "Envío ARS", "Total ARS"],
      ...summary.delivered.map((order) => [
        order.num,
        time(order.creadoEn),
        order.nombre ?? "",
        order.tipo,
        envioDe(order),
        orderTotal(order),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = days === 0 ? "clicks-ventas-turno.csv" : `clicks-ventas-${days}-dias.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const actions = [
    {
      label: "Tomar y gestionar pedidos",
      desc: "Mostrador, retiro y delivery",
      href: routes.caja(tenant.slug),
      icon: ShoppingBag,
    },
    {
      label: "Ver la cocina",
      desc: "Preparación y entregas",
      href: routes.cocina(tenant.slug),
      icon: ChefHat,
    },
    {
      label: "Administrar el menú",
      desc: "Productos, precios y categorías",
      href: routes.settings(tenant.slug),
      icon: Settings2,
    },
    {
      label: "Gestionar la caja",
      desc: "Apertura, arqueo y cierre",
      href: routes.cierre(tenant.slug),
      icon: Wallet,
    },
  ];

  return (
    <div className="clicks-dashboard">
      <header className="cd-header">
        <div>
          <p className="cd-business">Clicks Burger / Administración</p>
          <h1>Tu local, de un vistazo.</h1>
          <p>Las ventas y la operación de Clicks, en un solo lugar.</p>
        </div>
        <Link
          href={routes.menu(tenant.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="cd-button cd-outline"
        >
          Ver página del local <ArrowUpRight size={17} />
        </Link>
      </header>

      <div className="cd-toolbar">
        <div role="group" aria-label="Período del reporte" className="cd-period">
          {[
            { value: 0, label: "Turno" },
            { value: 7, label: "7 días" },
            { value: 30, label: "30 días" },
          ].map((period) => (
            <button
              key={period.value}
              aria-pressed={days === period.value}
              onClick={() => setDays(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>
        <div className="cd-tools">
          <span>
            {loading
              ? "Actualizando…"
              : updated
                ? `Actualizado ${time(updated)}`
                : "Sin actualizar"}
          </span>
          <button
            className="cd-icon"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
            aria-label="Actualizar resumen"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            className="cd-button cd-outline"
            onClick={exportSales}
            disabled={loading || !!error || !summary.delivered.length}
          >
            <Download size={16} /> Exportar ventas
          </button>
        </div>
      </div>

      {error && (
        <div className="cd-error" role="alert">
          {error} Revisá la conexión y las migraciones de Supabase.{" "}
          <button onClick={() => setRevision((value) => value + 1)}>Reintentar</button>
        </div>
      )}
      <div aria-live="polite" aria-busy={loading}>
        {showSkeleton ? (
          <MetricsSkeleton />
        ) : (
          current && (
            <>
              <section className="cd-metrics" aria-label="Resumen de ventas">
                <div className="cd-revenue">
                  <span>Ventas de pedidos entregados</span>
                  <strong>{money(summary.revenue)}</strong>
                  <p>
                    {summary.delivered.length} pedidos entregados en el período
                    {summary.envios > 0 ? ` · incluye ${money(summary.envios)} de envíos` : ""}
                  </p>
                  <ShoppingBag className="cd-revenue-icon" size={76} strokeWidth={1} />
                </div>
                <div className="cd-stat">
                  <span>Ticket promedio</span>
                  <strong>{money(summary.average)}</strong>
                  <p>Por pedido entregado</p>
                </div>
                <div className="cd-stat">
                  <span>Productos vendidos</span>
                  <strong>
                    {summary.units}
                    <small> un.</small>
                  </strong>
                  <p>Unidades de pedidos entregados</p>
                </div>
                <div className="cd-stat">
                  <span>Pedidos en curso</span>
                  <strong>{current.activeCount}</strong>
                  <p>Todos los pendientes del local</p>
                </div>
              </section>
              <p className="cd-method">
                {days === 0
                  ? current.turno
                    ? current.turno.cerrado_en
                      ? `Último turno: ${time(current.turno.abierto_en)} a ${time(current.turno.cerrado_en)}. Se reinicia al abrir la caja. `
                      : `Turno abierto desde ${time(current.turno.abierto_en)}. Se reinicia al abrir la próxima caja. `
                    : "Todavía no hay turnos de caja: se muestra el día de hoy. "
                  : "Período por fecha de creación del pedido, en hora de Buenos Aires. "}
                Las ventas incluyen solo pedidos entregados; no representan cobros verificados.
              </p>

              <section className="cd-operation" aria-label="Estado del local">
                <div>
                  <span className={`cd-dot ${current.shift ? "cd-dot-open" : ""}`} />
                  <strong>{current.shift ? "Caja abierta" : "Caja cerrada"}</strong>
                  <span>
                    {current.shift
                      ? `Desde ${time(current.shift.abierto_en)}`
                      : "Abrí un turno para empezar a operar"}
                  </span>
                </div>
                <Link href={routes.cierre(tenant.slug)}>
                  {current.shift ? "Ver turno de caja" : "Abrir caja"} <ArrowUpRight size={16} />
                </Link>
              </section>
            </>
          )
        )}
      </div>

      <section className="cd-actions" aria-label="Accesos a la operación">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <action.icon size={24} strokeWidth={1.6} />
            <div>
              <strong>{action.label}</strong>
              <span>{action.desc}</span>
            </div>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </section>

      {showSkeleton && <ColumnsSkeleton />}
      {current && (
        <div className="cd-columns">
          <section className="cd-panel" id="ventas">
            <div className="cd-section-heading">
              <div>
                <h2>Últimos pedidos</h2>
                <p>Actividad del período seleccionado</p>
              </div>
              <Link href={routes.caja(tenant.slug)}>
                Ir a pedidos <ArrowUpRight size={16} />
              </Link>
            </div>
            {current.orders.length ? (
              <div className="cd-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido / cliente</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th className="cd-numeric">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.orders.slice(0, 8).map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>#{order.num}</strong>
                          <span className="cd-client">{order.nombre || "Sin nombre"}</span>
                        </td>
                        <td className="cd-date">{time(order.creadoEn)}</td>
                        <td>
                          <span className={`cd-status cd-status-${order.estado}`}>
                            {ESTADO_LABEL[order.estado]}
                          </span>
                        </td>
                        <td className="cd-numeric">{money(orderTotal(order))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="cd-empty">
                <ShoppingBag size={28} />
                <h3>Todavía no hay pedidos en este período</h3>
                <p>
                  Al recibir pedidos aparecerán acá. Podés elegir otro período o ir a caja para
                  cargar uno.
                </p>
                <Link href={routes.caja(tenant.slug)}>Ir a caja</Link>
              </div>
            )}
          </section>
          <section className="cd-panel" id="productos">
            <div className="cd-section-heading">
              <div>
                <h2>Los más pedidos</h2>
                <p>Por unidades vendidas</p>
              </div>
              <Package size={20} />
            </div>
            {summary.products.length ? (
              <ol className="cd-products">
                {summary.products.slice(0, 5).map((product, index) => (
                  <li key={product.name + index}>
                    <span className="cd-rank">{index + 1}</span>
                    <div>
                      <strong>{product.name}</strong>
                      <span>{money(product.revenue)} en ventas</span>
                      <div className="cd-track">
                        <span
                          style={{
                            width: `${(product.quantity / (summary.products[0]?.quantity || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <b>
                      {product.quantity}
                      <small> un.</small>
                    </b>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="cd-empty">
                <Package size={28} />
                <h3>Tu ranking empieza con la primera venta</h3>
                <p>Se calcula con los productos de pedidos entregados.</p>
              </div>
            )}
            <div className="cd-menu-summary">
              <span>
                <strong>{current.menuCount}</strong> productos activos en el menú
              </span>
              <Link href={routes.settings(tenant.slug)}>
                Editar menú <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>
        </div>
      )}
      <footer className="cd-footnote">
        <Package size={17} />
        <p>
          <strong>Próxima etapa: inventario de ingredientes.</strong> El menú permite activar y
          pausar productos. Para controlar existencias necesitamos registrar insumos, recetas y
          movimientos de stock.
        </p>
      </footer>
    </div>
  );
}

/** Esqueleto de las métricas y el estado de caja mientras llega el primer dato. */
function MetricsSkeleton() {
  return (
    <div className="cd-skeleton" aria-hidden="true">
      <span className="sr-only">Cargando datos de Clicks…</span>
      <section className="cd-metrics">
        <div className="cd-revenue cd-sk-revenue">
          <Sk className="cd-sk-line" style={{ width: "48%" }} />
          <Sk className="cd-sk-number" style={{ width: "62%" }} />
          <Sk className="cd-sk-line" style={{ width: "40%" }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="cd-stat">
            <Sk className="cd-sk-line" style={{ width: "55%" }} />
            <Sk className="cd-sk-number" style={{ width: `${45 + i * 8}%` }} />
            <Sk className="cd-sk-line" style={{ width: "70%" }} />
          </div>
        ))}
      </section>
      <Sk className="cd-sk-line" style={{ width: "min(560px, 80%)", margin: "14px 0 26px" }} />
      <div className="cd-operation">
        <Sk className="cd-sk-line" style={{ width: 220 }} />
        <Sk className="cd-sk-line" style={{ width: 110 }} />
      </div>
    </div>
  );
}

/** Esqueleto de "Últimos pedidos" y "Los más pedidos". */
function ColumnsSkeleton() {
  return (
    <div className="cd-columns cd-skeleton" aria-hidden="true">
      <section className="cd-panel">
        <div className="cd-section-heading">
          <div className="cd-sk-stack">
            <Sk className="cd-sk-title" style={{ width: 170 }} />
            <Sk className="cd-sk-line" style={{ width: 230 }} />
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="cd-sk-row">
            <div className="cd-sk-stack">
              <Sk className="cd-sk-line" style={{ width: 60 }} />
              <Sk className="cd-sk-line" style={{ width: 120 }} />
            </div>
            <Sk className="cd-sk-line" style={{ width: 90 }} />
            <Sk className="cd-sk-pill" />
            <Sk className="cd-sk-line" style={{ width: 70, marginLeft: "auto" }} />
          </div>
        ))}
      </section>
      <section className="cd-panel">
        <div className="cd-section-heading">
          <div className="cd-sk-stack">
            <Sk className="cd-sk-title" style={{ width: 150 }} />
            <Sk className="cd-sk-line" style={{ width: 120 }} />
          </div>
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="cd-sk-rank">
            <Sk className="cd-sk-dot" />
            <div className="cd-sk-stack" style={{ flex: 1 }}>
              <Sk className="cd-sk-line" style={{ width: `${70 - i * 8}%` }} />
              <Sk className="cd-sk-bar" style={{ width: `${100 - i * 15}%` }} />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
