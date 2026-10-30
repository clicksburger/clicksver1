/** Formato de precio en pesos argentinos. */
export function formatPrecio(valor: number | null | undefined): string {
  if (valor == null) return "-";
  return "$" + valor.toLocaleString("es-AR");
}

/** Hora corta local (HH:mm). */
export function horaCorta(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
