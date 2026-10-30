"use client";
import { useEffect } from "react";

let locks = 0;
let previousOverflow = "";
/** Permite un modal sobre el carrito móvil sin desbloquear el fondo al cerrarlo. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (locks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks++;
    return () => {
      locks--;
      if (locks === 0) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
