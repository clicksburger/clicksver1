/**
 * Se muestra al instante al cambiar de sección (Resumen, Caja, Cierre, Cocina,
 * Configuración) mientras el servidor valida la sesión y arma la página.
 * Next lo precarga junto con los enlaces del menú, así el clic responde de
 * inmediato en vez de quedarse congelado en la pantalla anterior.
 */
export default function StaffLoading() {
  return (
    <div className="ops-board" role="status" aria-live="polite">
      <span className="sr-only">Cargando sección…</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mb-6 flex flex-col gap-2">
          <div className="h-7 w-56 rounded-lg bg-surface2" />
          <div className="h-4 w-80 max-w-full rounded bg-surface2" />
        </div>
        <div className="mb-6 flex gap-3 border-b border-border pb-3">
          {[0, 1, 2].map((tab) => (
            <div key={tab} className="h-9 w-28 rounded-lg bg-surface2" />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
          {[0, 1, 2].map((card) => (
            <div key={card} className="h-56 rounded-xl border border-border bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
