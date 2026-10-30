"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { updateHorarios } from "@/features/tenants/services/tenants.client";
import { revalidateTenant } from "@/features/tenants/actions";
import { DIAS, horariosDefault } from "@/features/tenants/horarios";
import type { HorarioDia, Tenant } from "@/types/domain";

const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo

export function HorariosForm({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [dias, setDias] = useState<HorarioDia[]>(tenant.horarios ?? horariosDefault());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set(dia: number, patch: Partial<HorarioDia>) {
    setDias((ds) => ds.map((d) => (d.dia === dia ? { ...d, ...patch } : d)));
  }

  async function guardar() {
    setSaving(true);
    setMsg(null);
    try {
      await updateHorarios(tenant.id, dias);
      await revalidateTenant(tenant.slug);
      setMsg("Guardado ✓");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-3">
      <p className="text-sm text-muted">
        Fuera de estos horarios el menú queda visible pero no se pueden enviar pedidos.
      </p>
      {ORDEN.map((dia) => {
        const d = dias.find((x) => x.dia === dia) ?? { dia, abierto: false, abre: "11:00", cierra: "23:00" };
        return (
          <div
            key={dia}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <label className="flex w-32 items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={d.abierto}
                onChange={(e) => set(dia, { abierto: e.target.checked })}
              />
              {DIAS[dia]}
            </label>
            {d.abierto ? (
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  value={d.abre}
                  onChange={(e) => set(dia, { abre: e.target.value })}
                  className="rounded-lg border border-border bg-surface2 px-2 py-1 text-text"
                />
                <span className="text-muted">a</span>
                <input
                  type="time"
                  value={d.cierra}
                  onChange={(e) => set(dia, { cierra: e.target.value })}
                  className="rounded-lg border border-border bg-surface2 px-2 py-1 text-text"
                />
              </div>
            ) : (
              <span className="text-sm text-muted">Cerrado</span>
            )}
          </div>
        );
      })}
      {msg && <p className="text-sm text-muted">{msg}</p>}
      <Button loading={saving} onClick={guardar}>
        Guardar horarios
      </Button>
    </div>
  );
}
