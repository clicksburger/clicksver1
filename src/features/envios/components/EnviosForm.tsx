"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { formatPrecio } from "@/lib/format";
import { guardarEnvioConfig, probarEnvio } from "../actions";
import {
  DIRECCION_LOCAL_DEFAULT,
  MOTIVO_A_CONFIRMAR,
  TRAMOS_DEFAULT,
  formatKm,
  mapsUrl,
  normalizarTramos,
} from "../tarifas";
import type { CotizacionEnvio, Tenant } from "@/types/domain";

interface FilaTramo {
  hastaKm: string;
  costo: string;
}

const aNumero = (value: string) => Number(value.replace(",", "."));
const inputClass =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary";

export function EnviosForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const inicial = tenant.envio;
  const [direccion, setDireccion] = useState(inicial?.direccion ?? DIRECCION_LOCAL_DEFAULT);
  const [filas, setFilas] = useState<FilaTramo[]>(
    (inicial?.tramos.length ? inicial.tramos : TRAMOS_DEFAULT).map((t) => ({
      hastaKm: String(t.hastaKm).replace(".", ","),
      costo: String(t.costo),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prueba, setPrueba] = useState("");
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<CotizacionEnvio | null>(null);
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  const tramos = filas.map((f) => ({ hastaKm: aNumero(f.hastaKm), costo: aNumero(f.costo) }));
  const invalida = tramos.some(
    (t) =>
      !Number.isFinite(t.hastaKm) || t.hastaKm <= 0 || !Number.isFinite(t.costo) || t.costo < 0,
  );
  const ordenados = invalida ? [] : normalizarTramos(tramos);
  const ubicado = inicial?.lat != null && inicial.lng != null;

  const set = (i: number, patch: Partial<FilaTramo>) =>
    setFilas((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  async function guardar() {
    if (invalida) {
      setMsg("Revisá los tramos: los km y los precios tienen que ser números positivos.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const r = await guardarEnvioConfig(tenant.id, tenant.slug, { direccion, tramos: ordenados });
      setMsg(r.ubicacionLocal ? `${r.mensaje} Local ubicado en: ${r.ubicacionLocal}` : r.mensaje);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function probar() {
    setProbando(true);
    setErrorPrueba(null);
    setResultado(null);
    try {
      setResultado(await probarEnvio(tenant.id, prueba));
    } catch (e) {
      setErrorPrueba(e instanceof Error ? e.message : "No se pudo calcular");
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <p className="text-sm text-muted">
        El costo de envío se calcula según la distancia en línea recta entre el local y la dirección
        del cliente. Si la dirección supera el último tramo o no se encuentra en el mapa, el envío
        queda <strong>a confirmar por WhatsApp</strong>.
      </p>

      <label className="flex flex-col gap-2 text-sm font-bold">
        Dirección del local
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          maxLength={240}
          className={inputClass}
        />
        <span className="text-xs font-normal text-muted">
          {ubicado ? (
            <>
              Ubicado en el mapa ·{" "}
              <a
                className="underline"
                href={mapsUrl(inicial!.lat!, inicial!.lng!)}
                target="_blank"
                rel="noopener noreferrer"
              >
                ver
              </a>
            </>
          ) : (
            "Se ubica en el mapa al guardar."
          )}
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Tramos de precio</legend>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted">
          <span>Hasta (km)</span>
          <span>Costo ($)</span>
          <span className="w-8" />
        </div>
        {filas.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <input
              inputMode="decimal"
              value={f.hastaKm}
              onChange={(e) => set(i, { hastaKm: e.target.value })}
              aria-label={`Tramo ${i + 1}: hasta km`}
              className={inputClass}
            />
            <input
              inputMode="numeric"
              value={f.costo}
              onChange={(e) => set(i, { costo: e.target.value })}
              aria-label={`Tramo ${i + 1}: costo`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setFilas((fs) => fs.filter((_, idx) => idx !== i))}
              disabled={filas.length === 1}
              aria-label="Quitar tramo"
              className="w-8 p-1 text-muted hover:text-danger disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFilas((fs) => [...fs, { hastaKm: "", costo: "" }])}
          className="flex items-center gap-1 self-start text-sm font-bold text-primary"
        >
          <Plus className="h-4 w-4" /> Agregar tramo
        </button>
        {!invalida && ordenados.length > 0 && (
          <ul className="mt-2 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted">
            {ordenados.map((t, i) => (
              <li key={t.hastaKm}>
                {i === 0
                  ? `Hasta ${formatKm(t.hastaKm)}`
                  : `Más de ${formatKm(ordenados[i - 1]!.hastaKm)} y hasta ${formatKm(t.hastaKm)}`}
                : <strong className="text-text">{formatPrecio(t.costo)}</strong>
              </li>
            ))}
            <li>
              Más de {formatKm(ordenados[ordenados.length - 1]!.hastaKm)}:{" "}
              <strong className="text-text">a confirmar por WhatsApp</strong>
            </li>
          </ul>
        )}
      </fieldset>

      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button loading={saving} onClick={guardar}>
        Guardar envíos
      </Button>

      <section className="flex flex-col gap-2 border-t border-border pt-5">
        <h3 className="text-sm font-bold">Probar una dirección</h3>
        <p className="text-xs text-muted">
          Usa la configuración guardada. Sirve para revisar cuánto le saldría el envío a un cliente.
        </p>
        <div className="flex gap-2">
          <input
            value={prueba}
            onChange={(e) => setPrueba(e.target.value)}
            placeholder="Ej.: Av. Juan B. Justo 5000"
            className={inputClass}
          />
          <Button loading={probando} onClick={probar} disabled={prueba.trim().length < 5}>
            Probar
          </Button>
        </div>
        {errorPrueba && <p className="text-sm text-danger">{errorPrueba}</p>}
        {resultado && (
          <div className="rounded-lg border border-border bg-surface p-3 text-sm">
            {resultado.direccion && <p className="text-text">{resultado.direccion}</p>}
            {resultado.estado === "calculado" ? (
              <p className="text-muted">
                {formatKm(resultado.km)} · Envío{" "}
                <strong className="text-primary">{formatPrecio(resultado.costo)}</strong>
              </p>
            ) : (
              <p className="text-muted">
                {resultado.km != null ? `${formatKm(resultado.km)} · ` : ""}A confirmar:{" "}
                {MOTIVO_A_CONFIRMAR[resultado.motivo]}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
