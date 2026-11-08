"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  Paperclip,
  Store,
  X,
} from "lucide-react";
import { formatPrecio } from "@/lib/format";
import { MOTIVO_A_CONFIRMAR, aConfirmar, formatKm } from "@/features/envios/tarifas";
import { ALIAS_TRANSFERENCIA } from "@/constants/business";
import { guardarUltimoPedido } from "@/features/orders/seguimiento";
import type { CotizacionEnvio, PedidoItem } from "@/types/domain";

interface Receipt {
  /** Id del pedido (para el seguimiento). Falta en respuestas de versiones viejas. */
  id?: string;
  num: number;
  total: number;
  /** null en pedidos de mostrador: no se manda nada por WhatsApp. */
  whatsappUrl: string | null;
  mostrador?: boolean;
  costoEnvio?: number | null;
  envioAConfirmar?: boolean;
}
export interface CheckoutAttempt {
  requestId?: string;
  body?: string;
  receipt?: Receipt;
  /** Última cotización de envío y la dirección a la que corresponde. */
  envio?: { para: string; cotizacion: CotizacionEnvio };
}

const normalizarDireccion = (value: string) => value.trim().replace(/\s+/g, " ");

type TipoEntrega = "takeaway" | "delivery" | "salon";
const ENTREGAS_ONLINE: { value: TipoEntrega; label: string }[] = [
  { value: "takeaway", label: "Lo retiro personalmente" },
  { value: "delivery", label: "Necesito que me lo envíen" },
];
const ENTREGAS_MOSTRADOR: { value: TipoEntrega; label: string }[] = [
  { value: "salon", label: "Come en el local" },
  { value: "takeaway", label: "Para llevar" },
  { value: "delivery", label: "Envío a domicilio" },
];

const MERCADO_PAGO_WEB = "https://www.mercadopago.com.ar/";
const MAX_COMPROBANTE_MB = 4;

/**
 * Copia el alias y abre Mercado Pago. No existe un link oficial que precargue
 * el alias: el cliente lo pega en "Transferir". En Android intenta la app
 * (si no está, abre la web); en iPhone y computadora abre la web, que en el
 * celular puede pasar a la app si está instalada. Siempre en otra pestaña,
 * para no perder el pedido a medio cargar.
 */
function abrirMercadoPago() {
  // Se copia antes de abrir la pestaña: después la página pierde el foco.
  void navigator.clipboard?.writeText(ALIAS_TRANSFERENCIA).catch(() => undefined);
  const android = /Android/i.test(navigator.userAgent);
  const destino = android
    ? `intent://home#Intent;scheme=mercadopago;package=com.mercadopago.wallet;S.browser_fallback_url=${encodeURIComponent(MERCADO_PAGO_WEB)};end`
    : MERCADO_PAGO_WEB;
  window.open(destino, "_blank", "noopener");
}

/**
 * Alias del local, botón para copiarlo y abrir Mercado Pago, y comprobante
 * opcional: si lo adjunta, va con el pedido; si no, el pedido sigue igual y
 * lo puede mandar después por WhatsApp.
 */
function AliasTransferencia({
  envioAConfirmar,
  archivo,
  onArchivo,
  adjuntado,
  mostrador = false,
}: {
  envioAConfirmar: boolean;
  /** Pedido de mostrador: solo el alias para pasárselo al cliente. */
  mostrador?: boolean;
  /** Solo en el formulario: comprobante elegido (opcional). */
  archivo?: File | null;
  onArchivo?: (archivo: File | null) => void;
  /** Ya guardado: el comprobante se subió con el pedido. */
  adjuntado?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const marcarCopiado = () => {
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  async function copiar() {
    try {
      await navigator.clipboard.writeText(ALIAS_TRANSFERENCIA);
      marcarCopiado();
    } catch {
      /* Sin permiso de portapapeles: el alias queda visible para copiarlo a mano. */
    }
  }
  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-primary bg-surface2 p-3 text-left text-xs leading-relaxed">
      <p className="flex items-center gap-2 font-bold text-text">
        <Landmark size={15} className="text-primary" /> Transferí al alias
      </p>
      <div className="flex items-center justify-between gap-3">
        <strong className="select-all font-display text-2xl tracking-wide text-primary">
          {ALIAS_TRANSFERENCIA}
        </strong>
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary px-3 py-2 font-bold text-primary"
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      {mostrador ? (
        <p className="text-muted">
          Pasale el alias al cliente y verificá la transferencia antes de entregar.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              abrirMercadoPago();
              marcarCopiado();
            }}
            className="cm-mp-button inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold"
          >
            Copiar alias y abrir Mercado Pago <ExternalLink size={15} />
          </button>
          <p className="text-muted">Pegá el alias en Mercado Pago → Transferir.</p>
          {envioAConfirmar && (
            <p className="text-muted">
              Como el envío está a confirmar, podés esperar que el local te pase el total antes de
              transferir.
            </p>
          )}
          {onArchivo ? (
            <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
              {archivo ? (
                <div className="flex items-center gap-2 rounded-lg border border-[#72d49d] bg-[#72d49d1a] px-3 py-2">
                  <Paperclip size={14} className="shrink-0 text-[#72d49d]" />
                  <span className="min-w-0 flex-1 truncate text-text">{archivo.name}</span>
                  <button
                    type="button"
                    onClick={() => onArchivo(null)}
                    aria-label="Quitar comprobante"
                    className="rounded p-1 text-muted hover:text-text"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="cm-comprobante-input flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 font-bold text-text hover:border-primary">
                  <Paperclip size={14} className="text-primary" /> Adjuntar comprobante (opcional)
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const elegido = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      if (elegido && elegido.size > MAX_COMPROBANTE_MB * 1024 * 1024) {
                        setErrorArchivo(`El archivo pesa más de ${MAX_COMPROBANTE_MB} MB.`);
                        return;
                      }
                      setErrorArchivo(null);
                      onArchivo(elegido);
                    }}
                  />
                </label>
              )}
              {errorArchivo && <p className="text-danger">{errorArchivo}</p>}
              <p className="text-muted">
                {archivo
                  ? "Se envía al local junto con tu pedido, en el mensaje de WhatsApp."
                  : "Si ya transferiste, adjuntalo y le llega al local con el pedido. Si no, seguí igual y mandalo después por WhatsApp."}
              </p>
            </div>
          ) : adjuntado ? (
            <p className="flex items-center gap-1.5 font-bold text-[#72d49d]">
              <Check size={14} /> Comprobante adjuntado: va en el mensaje de WhatsApp.
            </p>
          ) : (
            <p className="text-muted">
              Cuando transfieras, <strong className="text-text">mandá el comprobante</strong> por el
              chat de WhatsApp.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function CheckoutForm({
  items,
  cerrado: cerradoCarta,
  onSaved,
  attempt,
  onSubmitting,
  mostrador = false,
  onOtroPedido,
}: {
  items: PedidoItem[];
  cerrado: boolean;
  onSaved: () => void;
  attempt: CheckoutAttempt;
  onSubmitting: (saving: boolean) => void;
  /** Pedido cargado por la caja: entra directo, sin WhatsApp. */
  mostrador?: boolean;
  /** Mostrador: cierra el comprobante para cargar el próximo pedido. */
  onOtroPedido?: () => void;
}) {
  // La caja carga pedidos de mostrador aunque la carta figure cerrada.
  const cerrado = cerradoCarta && !mostrador;
  const previous = attempt.body
    ? (JSON.parse(attempt.body) as {
        nombre: string;
        telefono: string;
        tipo: TipoEntrega;
        direccion: string;
        referencia: string;
        pago: string;
      })
    : null;
  const [tipo, setTipo] = useState<TipoEntrega>(previous?.tipo ?? "takeaway");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(attempt.receipt ?? null);
  const requestId = useRef<string | null>(attempt.requestId ?? null);
  const busy = useRef(false);
  const pendingBody = useRef<string | null>(attempt.body ?? null);
  const [locked, setLocked] = useState(!!attempt.body);
  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const [direccion, setDireccion] = useState(previous?.direccion ?? "");
  const [envio, setEnvio] = useState(attempt.envio ?? null);
  const [cotizando, setCotizando] = useState(false);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const [pago, setPago] = useState<string | null>(previous?.pago ?? null);
  /** Comprobante opcional elegido en el formulario y si se pudo subir con el pedido. */
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobanteSubido, setComprobanteSubido] = useState(false);
  const cotizacionEnCurso = useRef<string | null>(null);
  const direccionActual = normalizarDireccion(direccion);
  const cotizacion =
    tipo === "delivery" && envio && envio.para === direccionActual ? envio.cotizacion : null;
  const costoEnvio = cotizacion?.estado === "calculado" ? cotizacion.costo : 0;

  function guardarEnvio(para: string, nueva: CotizacionEnvio) {
    const value = { para, cotizacion: nueva };
    attempt.envio = value;
    setEnvio(value);
  }

  /** Pide al servidor el costo de envío de la dirección escrita. Devuelve la cotización o null. */
  async function cotizarEnvio(): Promise<CotizacionEnvio | null> {
    const para = direccionActual;
    if (para.length < 5) {
      setEnvioError("Ingresá calle y altura para calcular el envío.");
      return null;
    }
    if (envio?.para === para) return envio.cotizacion;
    if (cotizacionEnCurso.current === para) return null;
    cotizacionEnCurso.current = para;
    setCotizando(true);
    setEnvioError(null);
    try {
      const response = await fetch("/api/envio/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direccion: para }),
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo calcular el envío.");
      guardarEnvio(para, result as CotizacionEnvio);
      return result as CotizacionEnvio;
    } catch {
      // Sin cotización (sin conexión, límite de consultas, servicio caído): el pedido
      // sigue con el envío "a confirmar" y el cliente lo informa por WhatsApp.
      const sinCalculo = aConfirmar("no_disponible");
      guardarEnvio(para, sinCalculo);
      return sinCalculo;
    } finally {
      cotizacionEnCurso.current = null;
      setCotizando(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || receipt || cerrado) return;
    const form = new FormData(event.currentTarget);
    if (!pendingBody.current && tipo === "delivery" && !cotizacion) {
      // Primero se muestra el costo de envío; el cliente confirma con un segundo toque.
      await cotizarEnvio();
      return;
    }
    busy.current = true;
    setLoading(true);
    onSubmitting(true);
    setLocked(true);
    setError(null);
    // Abrir en el gesto del usuario evita bloqueos de pop-ups después del guardado.
    // En el mostrador no se abre WhatsApp: el pedido ya se confirmó en persona.
    const popup = mostrador ? null : window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      if (!pendingBody.current) {
        requestId.current ??= crypto.randomUUID();
        // Comprobante opcional: si falla la subida, el pedido sigue igual (se manda por WhatsApp).
        let conComprobante = false;
        if (!mostrador && form.get("pago") === "transferencia" && comprobante) {
          try {
            const datos = new FormData();
            datos.set("pedidoId", requestId.current);
            datos.set("archivo", comprobante);
            const subida = await fetch("/api/comprobante", {
              method: "POST",
              body: datos,
              signal: AbortSignal.timeout(30000),
            });
            conComprobante = subida.ok;
          } catch {
            conComprobante = false;
          }
          setComprobanteSubido(conComprobante);
        }
        pendingBody.current = JSON.stringify({
          expectedTotal: total,
          expectedEnvio: tipo === "delivery" ? (cotizacion?.costo ?? null) : undefined,
          requestId: requestId.current,
          ...(mostrador ? { mostrador: true } : {}),
          nombre: form.get("nombre"),
          telefono: form.get("telefono"),
          tipo,
          direccion: tipo === "delivery" ? direccionActual : "",
          referencia: form.get("referencia") ?? "",
          pago: form.get("pago"),
          ...(conComprobante ? { comprobante: true } : {}),
          items: items.map(({ itemId, variante, cantidad, obs }) => ({
            itemId,
            variante,
            cantidad,
            obs,
          })),
        });
        attempt.requestId = requestId.current;
        attempt.body = pendingBody.current;
      }
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingBody.current,
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) {
        // 400 y 409 son errores determinados antes de guardar; permiten corregir.
        if (
          response.status === 400 ||
          response.status === 403 ||
          (response.status === 409 && !result.alreadySaved)
        ) {
          pendingBody.current = null;
          delete attempt.body;
          setLocked(false);
          // El servidor recalculó el envío: se muestra el valor nuevo para que el cliente lo vea.
          if (result.envio) guardarEnvio(direccionActual, result.envio as CotizacionEnvio);
        }
        throw new Error(result.error || "No se pudo registrar el pedido.");
      }
      const saved = result as Receipt;
      // El aviso "Tu pedido #N" de la carta es para el cliente, no para la compu de la caja.
      if (saved.id && !saved.mostrador) guardarUltimoPedido(saved.id, saved.num);
      attempt.receipt = saved;
      setReceipt(saved);
      onSaved();
      if (popup && !popup.closed) {
        if (saved.whatsappUrl) popup.location.href = saved.whatsappUrl;
        else popup.close();
      }
    } catch (cause) {
      popup?.close();
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo confirmar el registro. Reintentá para recuperar el pedido.",
      );
    } finally {
      busy.current = false;
      setLoading(false);
      onSubmitting(false);
    }
  }

  if (receipt && (receipt.mostrador || !receipt.whatsappUrl))
    return (
      <div className="flex flex-col items-center gap-4 py-3 text-center" role="status">
        <CheckCircle2 size={42} className="text-primary" />
        <h3 className="text-xl font-bold">Pedido #{receipt.num} cargado</h3>
        <p className="text-sm leading-relaxed text-muted">
          Ya está en <strong className="text-text">Entrantes</strong> de la caja. Confirmalo ahí
          para mandarlo a cocina. No se envió nada por WhatsApp.
        </p>
        <p className="font-display text-2xl text-primary">{formatPrecio(receipt.total)}</p>
        {receipt.costoEnvio != null && receipt.costoEnvio > 0 && (
          <p className="-mt-3 text-xs text-muted">
            Incluye envío de {formatPrecio(receipt.costoEnvio)}
          </p>
        )}
        {receipt.envioAConfirmar && (
          <p className="rounded-xl border border-primary px-3 py-2 text-sm">
            El envío quedó a confirmar: acordalo con el cliente y cargalo con Editar en la caja.
          </p>
        )}
        {pago === "transferencia" && (
          <div className="w-full">
            <AliasTransferencia envioAConfirmar={!!receipt.envioAConfirmar} mostrador />
          </div>
        )}
        <button
          type="button"
          onClick={onOtroPedido}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-bg"
        >
          <Store size={20} /> Cargar otro pedido
        </button>
      </div>
    );

  if (receipt)
    return (
      <div className="flex flex-col items-center gap-4 py-3 text-center" role="status">
        <CheckCircle2 size={42} className="text-primary" />
        <h3 className="text-xl font-bold">Pedido #{receipt.num} guardado</h3>
        <p className="text-sm leading-relaxed text-muted">
          Ya aparece en el sistema del local. En WhatsApp, revisá el resumen y pulsá Enviar para
          completar el mensaje.
        </p>
        <p className="font-display text-2xl text-primary">{formatPrecio(receipt.total)}</p>
        {receipt.costoEnvio != null && receipt.costoEnvio > 0 && (
          <p className="-mt-3 text-xs text-muted">
            Incluye envío de {formatPrecio(receipt.costoEnvio)}
          </p>
        )}
        {receipt.envioAConfirmar && (
          <p className="rounded-xl border border-primary px-3 py-2 text-sm">
            El costo del envío se confirma por WhatsApp: el local te va a responder con el valor
            antes de preparar el pedido.
          </p>
        )}
        {pago === "transferencia" && (
          <div className="w-full">
            <AliasTransferencia
              envioAConfirmar={!!receipt.envioAConfirmar}
              adjuntado={comprobanteSubido}
            />
          </div>
        )}
        <a
          href={receipt.whatsappUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-bg"
        >
          <MessageCircle size={20} /> Abrir WhatsApp
        </a>
        {receipt.id && (
          <Link
            href={`/pedido/${receipt.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 font-bold text-primary"
          >
            <MapPin size={18} /> Seguir mi pedido
          </Link>
        )}
        <p className="text-xs text-muted">
          Si WhatsApp no se abrió, usá el botón de WhatsApp: abrirlo otra vez no crea otro pedido.
          En “Seguir mi pedido” ves cuando el local lo confirma, lo prepara y sale.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        {mostrador
          ? "Pedido tomado en el mostrador: entra directo a la caja, sin WhatsApp."
          : "Completá tus datos para coordinar tu pedido con Clicks."}
      </p>
      <details className="rounded-xl border border-border p-3 text-sm">
        <summary className="cursor-pointer font-bold">
          Resumen de productos ({items.reduce((count, item) => count + item.cantidad, 0)})
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-xs text-muted">
          {items.map((item, index) => (
            <li key={index}>
              {item.cantidad} × {item.nombre}
              {item.variante ? ` · ${item.variante}` : ""}
              {item.obs ? ` · ${item.obs}` : ""}
            </li>
          ))}
        </ul>
      </details>
      {locked && !loading && (
        <p className="text-sm text-muted">
          Conservamos el intento anterior y sus datos para evitar pedidos duplicados.
        </p>
      )}
      <fieldset disabled={loading || locked} className="flex flex-col gap-5 disabled:opacity-75">
        <label className="flex flex-col gap-2 text-sm font-bold">
          {mostrador ? "Nombre del cliente *" : "Nombre y apellido *"}
          <input
            name="nombre"
            defaultValue={previous?.nombre}
            required
            minLength={mostrador ? 2 : 3}
            maxLength={100}
            autoComplete={mostrador ? "off" : "name"}
            placeholder={
              mostrador ? "Para llamarlo cuando esté listo" : "Necesitamos saber cómo te llamás"
            }
            className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-bold">
          {mostrador ? "Teléfono (opcional)" : "Teléfono *"}
          <input
            name="telefono"
            defaultValue={previous?.telefono}
            required={!mostrador}
            type="tel"
            minLength={8}
            maxLength={30}
            autoComplete={mostrador ? "off" : "tel"}
            placeholder={
              mostrador ? "Solo si hace falta contactarlo" : "Un número para contactarte"
            }
            className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <fieldset className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-bold">Forma de entrega *</legend>
          <div className={`grid gap-3 ${mostrador ? "grid-cols-3" : "grid-cols-2"}`}>
            {(mostrador ? ENTREGAS_MOSTRADOR : ENTREGAS_ONLINE).map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${tipo === option.value ? "border-primary bg-surface3" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={option.value}
                  checked={tipo === option.value}
                  onChange={() => setTipo(option.value)}
                  className="accent-[#ffd21c]"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {tipo === "delivery" && (
          <>
            <div className="flex flex-col gap-2 text-sm font-bold">
              <label htmlFor="checkout-direccion">Dirección de entrega *</label>
              <div className="flex gap-2">
                <input
                  id="checkout-direccion"
                  name="direccion"
                  value={direccion}
                  onChange={(event) => {
                    setDireccion(event.target.value);
                    setEnvioError(null);
                  }}
                  onBlur={() => {
                    if (direccionActual.length >= 5 && envio?.para !== direccionActual)
                      void cotizarEnvio();
                  }}
                  required
                  minLength={5}
                  maxLength={240}
                  autoComplete="street-address"
                  placeholder="Calle y altura, barrio"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => void cotizarEnvio()}
                  disabled={cotizando || direccionActual.length < 5 || !!cotizacion}
                  className="shrink-0 rounded-xl border border-primary px-3 text-xs font-bold text-primary disabled:opacity-40"
                >
                  Calcular envío
                </button>
              </div>
              <div aria-live="polite" className="font-normal">
                {cotizando && (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 size={14} className="animate-spin" /> Calculando envío…
                  </p>
                )}
                {!cotizando && envioError && <p className="text-xs text-danger">{envioError}</p>}
                {!cotizando && cotizacion?.estado === "calculado" && (
                  <div className="flex items-start gap-2 rounded-xl border border-border bg-surface2 p-3 text-xs leading-relaxed">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div className="flex-1">
                      <p className="text-text">{cotizacion.direccion}</p>
                      <p className="text-muted">
                        A {formatKm(cotizacion.km)} del local · Envío{" "}
                        <strong className="text-primary">{formatPrecio(cotizacion.costo)}</strong>
                      </p>
                      <p className="mt-1 text-muted">
                        ¿No es tu dirección? Corregila agregando el barrio.
                      </p>
                    </div>
                  </div>
                )}
                {!cotizando && cotizacion?.estado === "a_confirmar" && (
                  <div className="rounded-xl border border-primary p-3 text-xs leading-relaxed">
                    <p className="font-bold text-text">No podemos calcular tu envío</p>
                    <p className="text-muted">
                      {MOTIVO_A_CONFIRMAR[cotizacion.motivo]}{" "}
                      {mostrador ? (
                        <>
                          Acordá el costo con el cliente y cargalo después con Editar. Podés seguir
                          con el pedido igual.
                        </>
                      ) : (
                        <>
                          <strong className="text-text">
                            Informalo cuando envíes el pedido por WhatsApp
                          </strong>{" "}
                          y el local te confirma el costo antes de prepararlo. Podés seguir con el
                          pedido igual.
                        </>
                      )}
                    </p>
                  </div>
                )}
                {!cotizando && !cotizacion && !envioError && (
                  <p className="text-xs text-muted">
                    El costo del envío se calcula según la distancia al local.
                  </p>
                )}
              </div>
            </div>
            <label className="flex flex-col gap-2 text-sm font-bold">
              Piso, departamento o referencia
              <input
                name="referencia"
                defaultValue={previous?.referencia}
                maxLength={150}
                placeholder="Opcional"
                className="rounded-xl border border-border bg-surface2 px-3 py-3 text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </>
        )}
        <fieldset className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-bold">Forma de pago *</legend>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "efectivo", label: "Efectivo" },
              { value: "transferencia", label: "Transferencia" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="pago"
                  value={option.value}
                  defaultChecked={previous?.pago === option.value}
                  onChange={() => setPago(option.value)}
                  required
                  className="accent-[#ffd21c]"
                />
                {option.label}
              </label>
            ))}
          </div>
          {pago === "transferencia" ? (
            <AliasTransferencia
              envioAConfirmar={tipo === "delivery" && cotizacion?.estado !== "calculado"}
              mostrador={mostrador}
              archivo={mostrador ? undefined : comprobante}
              onArchivo={mostrador ? undefined : setComprobante}
            />
          ) : (
            <p className="mt-3 text-xs text-muted">
              {mostrador
                ? "Se cobra en el mostrador o al entregar."
                : "Pagás al recibir o retirar tu pedido."}
            </p>
          )}
        </fieldset>
      </fieldset>
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        {tipo === "delivery" && (
          <>
            <div className="flex justify-between text-sm text-muted">
              <span>Productos</span>
              <span>{formatPrecio(total)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted">
              <span>Envío</span>
              <span>
                {cotizacion?.estado === "calculado"
                  ? formatPrecio(cotizacion.costo)
                  : cotizacion?.estado === "a_confirmar"
                    ? "A confirmar"
                    : "Ingresá la dirección"}
              </span>
            </div>
          </>
        )}
        <div className="flex items-baseline justify-between">
          <span>
            {tipo === "delivery" && cotizacion?.estado !== "calculado"
              ? "Total de productos"
              : "Total"}
          </span>
          <strong className="font-display text-2xl text-primary">
            {formatPrecio(total + costoEnvio)}
          </strong>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {cerrado && <p className="text-sm text-danger">El local está cerrado en este momento.</p>}
      <button
        type="submit"
        disabled={loading || cerrado || cotizando}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-bg disabled:opacity-50"
      >
        {mostrador ? <Store size={20} /> : <MessageCircle size={20} />}
        {loading
          ? "Guardando pedido…"
          : cotizando
            ? "Calculando envío…"
            : tipo === "delivery" && !cotizacion && !locked
              ? "Calcular envío y continuar"
              : mostrador
                ? locked
                  ? "Reintentar carga"
                  : "Cargar pedido en caja"
                : locked
                  ? "Reintentar y abrir WhatsApp"
                  : "Confirmar y pedir por WhatsApp"}
      </button>
      <p className="text-xs leading-relaxed text-muted">
        {mostrador
          ? "El pedido aparece en Entrantes de la caja. No se envía nada por WhatsApp."
          : "Tu pedido quedará registrado en el local. En WhatsApp, revisá el mensaje y pulsá Enviar."}
      </p>
    </form>
  );
}
