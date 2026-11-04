"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, GalleryHorizontal, Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { Sk } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { fetchMenuAll } from "../services/menu.client";
import { estaVigente } from "../promos";
import {
  DIAS_CORTOS,
  MODOS_CARRUSEL,
  diaSemana,
  promoDelDiaActiva,
  textoDias,
  type CarruselConfig,
} from "../carrusel";
import { guardarCarrusel } from "../carrusel.actions";
import type { MenuItem, Tenant } from "@/types/domain";

const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Configuración del carrusel de la carta: qué carrusel se muestra (automático
 * por días, promo hoy o normal) y qué productos lleva cada uno.
 */
export function CarruselManager({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [config, setConfig] = useState<CarruselConfig>(tenant.carrusel);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    fetchMenuAll(tenant.id)
      .then(setItems)
      .catch(() => setMsg({ ok: false, texto: "No se pudo cargar el menú." }));
  }, [tenant.id]);

  const hoy = diaSemana();
  const promoHoy = promoDelDiaActiva(config);
  const porId = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  function toggle(lista: "promo" | "normal", id: string) {
    setMsg(null);
    setConfig((actual) => {
      const ids = actual[lista].includes(id)
        ? actual[lista].filter((x) => x !== id)
        : [...actual[lista], id];
      // Un producto de la promo del día no puede estar también en el normal (y al revés).
      const otra = lista === "promo" ? "normal" : "promo";
      return { ...actual, [lista]: ids, [otra]: actual[otra].filter((x) => x !== id) };
    });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const result = await guardarCarrusel(tenant.id, tenant.slug, config);
      setMsg({ ok: result.ok, texto: result.mensaje });
      if (result.ok) router.refresh();
    } catch (cause) {
      setMsg({ ok: false, texto: cause instanceof Error ? cause.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  }

  const lista = (
    clave: "promo" | "normal",
    titulo: string,
    ayuda: string,
    Icon: typeof Sparkles,
  ) => (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
      <div>
        <h3 className="flex items-center gap-2 font-bold text-text">
          <Icon className="h-4 w-4 text-primary" /> {titulo}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{ayuda}</p>
      </div>
      {items === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Sk key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const marcado = config[clave].includes(item.id);
            const estado = !item.activo
              ? "Pausado"
              : !estaVigente(item)
                ? "Vencida: se ve como No disponible"
                : null;
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition",
                    marcado
                      ? "bg-primary/10 border-primary"
                      : "hover:border-primary/60 border-border bg-surface2",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => toggle(clave, item.id)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {item.imagenUrl ? (
                    <img src={item.imagenUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="bg-primary/20 grid h-10 w-10 place-items-center rounded text-xs font-black text-primary">
                      2x
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-text">{item.nombre}</span>
                    <span className="text-xs text-muted">{estado ?? item.categoria}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">
        {config[clave].length
          ? `${config[clave].length} en este carrusel: ${config[clave]
              .map((id) => porId.get(id)?.nombre)
              .filter(Boolean)
              .join(", ")}`
          : "Sin productos: se usan los destacados de la carta."}
      </p>
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <GalleryHorizontal className="h-5 w-5 text-primary" /> ¿Qué carrusel se ve en la carta?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Hoy es {DIAS_LARGOS[hoy]}:{" "}
            <strong className={promoHoy ? "text-primary" : "text-text"}>
              {promoHoy ? "se muestra la promo del día" : "se muestra el carrusel normal"}
            </strong>
            .
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Modo del carrusel">
          {MODOS_CARRUSEL.map((modo) => (
            <button
              key={modo.value}
              type="button"
              role="radio"
              aria-checked={config.modo === modo.value}
              onClick={() => {
                setMsg(null);
                setConfig((c) => ({ ...c, modo: modo.value }));
              }}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition",
                config.modo === modo.value
                  ? "bg-primary/10 border-primary shadow-[0_0_0_1px_var(--color-primary)]"
                  : "hover:border-primary/60 border-border bg-surface2 hover:-translate-y-0.5",
              )}
            >
              <span className="font-bold text-text">{modo.label}</span>
              <span className="text-xs text-muted">
                {modo.value === "auto" && config.diasPromo.length
                  ? `Promo: ${textoDias(config.diasPromo).toLowerCase()}`
                  : modo.detalle}
              </span>
            </button>
          ))}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-text">
            <CalendarDays className="h-4 w-4 text-primary" /> Días de promo (modo automático)
          </p>
          <div className="flex flex-wrap gap-2">
            {DIAS_ORDEN.map((dia) => {
              const activo = config.diasPromo.includes(dia);
              return (
                <button
                  key={dia}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => {
                    setMsg(null);
                    setConfig((c) => ({
                      ...c,
                      diasPromo: activo
                        ? c.diasPromo.filter((d) => d !== dia)
                        : [...c.diasPromo, dia].sort(),
                    }));
                  }}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-bold transition",
                    activo
                      ? "border-primary bg-primary text-bg"
                      : "hover:border-primary/60 border-border text-muted hover:text-text",
                    dia === hoy && "ring-primary/40 ring-2 ring-offset-2 ring-offset-surface",
                  )}
                >
                  {DIAS_CORTOS[dia]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {lista(
          "promo",
          "Carrusel de promo",
          "Se muestra cuando hay promo. Estos productos solo aparecen en la carta y se pueden pedir mientras la promo está activa.",
          Megaphone,
        )}
        {lista(
          "normal",
          "Carrusel normal",
          "Se muestra cuando no hay promo. Si un producto está pausado o su promo venció, aparece apagado como “No disponible”.",
          Sparkles,
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={saving} onClick={save}>
          Guardar carrusel
        </Button>
        {msg && (
          <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role="status">
            {msg.texto}
          </p>
        )}
      </div>
    </div>
  );
}
