import { cn } from "@/lib/cn";

/**
 * Bloque de carga con brillo que lo recorre (clase global `.sk` en globals.css).
 * Los colores salen de --sk-base y --sk-shine, así cada pantalla los ajusta.
 */
export function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={cn("sk", className)} style={style} />;
}
