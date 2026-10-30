"use client";

import { useCallback, useEffect, useState } from "react";
import { DoorOpen, DoorClosed, RefreshCw, Wallet, History } from "lucide-react";
import { Button } from "@/components/ui";
import { Input, FormField } from "@/components/forms";
import { cn } from "@/lib/cn";
import { useSession } from "@/contexts/SessionContext";
import { formatPrecio } from "@/lib/format";
import {
  abrirCaja,
  cerrarCaja,
  getTurnoAbierto,
  listarTurnos,
  ventasActuales,
  type CajaTurno,
} from "../services/caja.client";

function fechaHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Diferencia({ valor }: { valor: number }) {
  const tono = valor === 0 ? "text-muted" : valor > 0 ? "text-success" : "text-danger";
  const signo = valor > 0 ? "+" : "";
  const etiqueta = valor === 0 ? "exacto" : valor > 0 ? "sobra" : "falta";
  return (
    <span className={cn("font-bold", tono)}>
      {signo}
      {formatPrecio(valor)} <span className="text-xs font-normal">({etiqueta})</span>
    </span>
  );
}

export function CierreCaja({ tenantId }: { tenantId: string }) {
  const session = useSession();
  const esAdmin = session.rol === "admin";

  const [cargando, setCargando] = useState(true);
  const [turno, setTurno] = useState<CajaTurno | null>(null);
  const [ventas, setVentas] = useState<{ total: number; cantidad: number } | null>(null);
  const [historial, setHistorial] = useState<CajaTurno[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<CajaTurno | null>(null);

  const [montoInicial, setMontoInicial] = useState("");
  const [notaApertura, setNotaApertura] = useState("");
  const [montoFinal, setMontoFinal] = useState("");
  const [notaCierre, setNotaCierre] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const t = await getTurnoAbierto(tenantId);
      setTurno(t);
      setVentas(t ? await ventasActuales(tenantId, t.abierto_en) : null);
      if (esAdmin) setHistorial(await listarTurnos(tenantId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar la caja");
    } finally {
      setCargando(false);
    }
  }, [tenantId, esAdmin]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function refrescarVentas() {
    if (!turno) return;
    try {
      setVentas(await ventasActuales(tenantId, turno.abierto_en));
    } catch {
      /* ignorar: el botón se puede reintentar */
    }
  }

  async function onAbrir() {
    setBusy(true);
    setError(null);
    setResultado(null);
    try {
      await abrirCaja({
        tenantId,
        userId: session.userId,
        email: session.email,
        montoInicial: Number(montoInicial) || 0,
        nota: notaApertura.trim() || null,
      });
      setMontoInicial("");
      setNotaApertura("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la caja");
    } finally {
      setBusy(false);
    }
  }

  async function onCerrar() {
    if (!turno) return;
    setBusy(true);
    setError(null);
    try {
      const cerrado = await cerrarCaja(turno.id, Number(montoFinal) || 0, notaCierre.trim() || null);
      setResultado(cerrado);
      setMontoFinal("");
      setNotaCierre("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar la caja");
    } finally {
      setBusy(false);
    }
  }

  const esperado = turno ? Number(turno.monto_inicial) + (ventas?.total ?? 0) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold">Caja — turno</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="py-12 text-center text-muted">Cargando…</p>
      ) : turno ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-bold text-success">
              <DoorOpen className="h-5 w-5" /> Caja abierta
            </span>
            <span className="text-sm text-muted">{turno.abierto_por_email ?? "—"}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-surface2 p-3">
              <p className="text-xs text-muted">Apertura</p>
              <p className="font-bold">{fechaHora(turno.abierto_en)}</p>
            </div>
            <div className="rounded-lg bg-surface2 p-3">
              <p className="text-xs text-muted">Fondo inicial</p>
              <p className="font-bold">{formatPrecio(Number(turno.monto_inicial))}</p>
            </div>
            <div className="rounded-lg bg-surface2 p-3">
              <p className="text-xs text-muted">Ventas del turno</p>
              <p className="font-bold text-primary">{formatPrecio(ventas?.total ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-surface2 p-3">
              <p className="text-xs text-muted">Pedidos</p>
              <p className="font-bold">{ventas?.cantidad ?? 0}</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-muted">Esperado en caja</span>
            <span className="font-display text-2xl text-text">{formatPrecio(esperado)}</span>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={refrescarVentas}>
              <RefreshCw className="h-4 w-4" /> Actualizar ventas
            </Button>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="font-bold">Cerrar caja</p>
            <FormField label="Monto contado" htmlFor="monto-final">
              <Input
                id="monto-final"
                type="number"
                inputMode="numeric"
                min="0"
                value={montoFinal}
                onChange={(e) => setMontoFinal(e.target.value)}
                placeholder="0"
              />
            </FormField>
            <FormField label="Nota (opcional)" htmlFor="nota-cierre">
              <Input
                id="nota-cierre"
                value={notaCierre}
                onChange={(e) => setNotaCierre(e.target.value)}
                placeholder="Observaciones del cierre"
              />
            </FormField>
            <Button variant="danger" loading={busy} onClick={onCerrar}>
              <DoorClosed className="h-4 w-4" /> Cerrar caja
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <span className="inline-flex items-center gap-2 font-bold text-muted">
            <Wallet className="h-5 w-5" /> No hay caja abierta
          </span>
          <FormField label="Fondo inicial" htmlFor="monto-inicial">
            <Input
              id="monto-inicial"
              type="number"
              inputMode="numeric"
              min="0"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField label="Nota (opcional)" htmlFor="nota-apertura">
            <Input
              id="nota-apertura"
              value={notaApertura}
              onChange={(e) => setNotaApertura(e.target.value)}
              placeholder="Observaciones de la apertura"
            />
          </FormField>
          <Button loading={busy} onClick={onAbrir}>
            <DoorOpen className="h-4 w-4" /> Abrir caja
          </Button>
        </div>
      )}

      {resultado && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-5">
          <p className="mb-3 font-bold">Resumen del cierre · turno {fechaHora(resultado.abierto_en)}</p>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Fondo inicial</span>
              <span>{formatPrecio(Number(resultado.monto_inicial))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Ventas ({resultado.pedidos_count ?? 0} pedidos)</span>
              <span>{formatPrecio(Number(resultado.ventas ?? 0))}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="text-muted">Esperado</span>
              <span>{formatPrecio(Number(resultado.monto_inicial) + Number(resultado.ventas ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Contado</span>
              <span>{formatPrecio(Number(resultado.monto_final ?? 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Diferencia</span>
              <Diferencia valor={Number(resultado.diferencia ?? 0)} />
            </div>
          </div>
        </div>
      )}

      {esAdmin && historial.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold">
            <History className="h-5 w-5" /> Historial de turnos
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface2 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Apertura</th>
                  <th className="px-3 py-2">Cierre</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2 text-right">Inicial</th>
                  <th className="px-3 py-2 text-right">Ventas</th>
                  <th className="px-3 py-2 text-right">Contado</th>
                  <th className="px-3 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2">{fechaHora(t.abierto_en)}</td>
                    <td className="px-3 py-2">{fechaHora(t.cerrado_en)}</td>
                    <td className="px-3 py-2 text-muted">{t.abierto_por_email ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{formatPrecio(Number(t.monto_inicial))}</td>
                    <td className="px-3 py-2 text-right">{formatPrecio(Number(t.ventas ?? 0))}</td>
                    <td className="px-3 py-2 text-right">{formatPrecio(Number(t.monto_final ?? 0))}</td>
                    <td className="px-3 py-2 text-right">
                      <Diferencia valor={Number(t.diferencia ?? 0)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
