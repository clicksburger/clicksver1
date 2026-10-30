"use client";

import { useEffect, useState } from "react";
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
import { loadDashboard } from "@/features/dashboard/dashboard.client";
import { money, orderTotal, periodStart, summarize } from "@/features/dashboard/summary";
import { ESTADO_LABEL } from "@/constants/order-states";
import { routes } from "@/constants/routes";
import type { Tenant } from "@/types/domain";
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
  const [days, setDays] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true);
      setError(null);
      try {
        const result = await loadDashboard(tenant.id, periodStart(days), new Date().toISOString());
        if (active) {
          setData(result);
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
    const timer = setInterval(() => void refresh(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tenant.id, days, revision]);

  const summary = summarize(data?.orders ?? []);
  function exportSales() {
    // Los textos se entrecomillan y neutralizan para evitar fórmulas al abrir el CSV.
    const cell = (value: string | number) =>
      `"${String(value)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      ["Pedido", "Fecha de creación", "Cliente", "Modalidad", "Total ARS"],
      ...summary.delivered.map((order) => [
        order.num,
        time(order.creadoEn),
        order.nombre ?? "",
        order.tipo,
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
    anchor.download = `clicks-ventas-${days}-dias.csv`;
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
            { value: 1, label: "Hoy" },
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
        {loading ? (
          <div className="cd-loading">Cargando datos de Clicks…</div>
        ) : (
          !error &&
          data && (
            <>
              <section className="cd-metrics" aria-label="Resumen de ventas">
                <div className="cd-revenue">
                  <span>Ventas de pedidos entregados</span>
                  <strong>{money(summary.revenue)}</strong>
                  <p>{summary.delivered.length} pedidos entregados en el período</p>
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
                  <strong>{data.activeCount}</strong>
                  <p>Todos los pendientes del local</p>
                </div>
              </section>
              <p className="cd-method">
                Período por fecha de creación del pedido, en hora de Buenos Aires. Las ventas
                incluyen solo pedidos entregados; no representan cobros verificados.
              </p>

              <section className="cd-operation" aria-label="Estado del local">
                <div>
                  <span className={`cd-dot ${data.shift ? "cd-dot-open" : ""}`} />
                  <strong>{data.shift ? "Caja abierta" : "Caja cerrada"}</strong>
                  <span>
                    {data.shift
                      ? `Desde ${time(data.shift.abierto_en)}`
                      : "Abrí un turno para empezar a operar"}
                  </span>
                </div>
                <Link href={routes.cierre(tenant.slug)}>
                  {data.shift ? "Ver turno de caja" : "Abrir caja"} <ArrowUpRight size={16} />
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

      {!loading && !error && data && (
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
            {data.orders.length ? (
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
                    {data.orders.slice(0, 8).map((order) => (
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
                <strong>{data.menuCount}</strong> productos activos en el menú
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
