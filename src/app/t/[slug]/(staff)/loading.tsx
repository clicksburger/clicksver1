import { Sk } from "@/components/ui/Skeleton";

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
      <div aria-hidden="true">
        <div className="mb-6 flex flex-col gap-3">
          <Sk className="h-7 w-56 rounded-lg" />
          <Sk className="h-4 w-80 max-w-full" />
        </div>
        <div className="mb-6 flex gap-3 border-b border-border pb-3">
          {[0, 1, 2].map((tab) => (
            <Sk key={tab} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-center justify-between">
                <Sk className="h-5 w-24" />
                <Sk className="h-6 w-20 rounded-full" />
              </div>
              <Sk className="h-4 w-3/4" />
              <Sk className="h-4 w-1/2" />
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
                <Sk className="h-3 w-full" />
                <Sk className="h-3 w-5/6" />
                <Sk className="h-3 w-2/3" />
              </div>
              <Sk className="mt-2 h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
