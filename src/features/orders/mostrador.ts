"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Modo mostrador de la carta: la caja abre "Cargar pedido" con `?mostrador=1`
 * y los pedidos de esa pestaña entran directo al sistema, sin WhatsApp.
 * Se recuerda solo en la pestaña (sessionStorage), así que cerrarla lo apaga.
 * El servidor igual exige la sesión de la caja para aceptar el pedido.
 */
const CLAVE = "clicks:mostrador";

function leer(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("mostrador");
    if (param === "1") sessionStorage.setItem(CLAVE, "1");
    if (param === "0") sessionStorage.removeItem(CLAVE);
    return sessionStorage.getItem(CLAVE) === "1";
  } catch {
    /* Sin almacenamiento: vale solo lo que dice la URL. */
    return new URLSearchParams(window.location.search).get("mostrador") === "1";
  }
}

export function useModoMostrador() {
  const [activo, setActivo] = useState(false);
  useEffect(() => {
    setActivo(leer());
  }, []);
  const salir = useCallback(() => {
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      /* nada que limpiar */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("mostrador");
    window.history.replaceState(null, "", url);
    setActivo(false);
  }, []);
  return { activo, salir };
}
