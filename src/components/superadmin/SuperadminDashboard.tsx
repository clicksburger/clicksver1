"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ExternalLink, LogOut } from "lucide-react";
import { Button, Modal, Badge } from "@/components/ui";
import { signOut } from "@/features/auth/services/auth.service";
import {
  getPlatformMetrics,
  listTenants,
  setTenantActivo,
  deleteTenant,
  type PlatformMetrics,
} from "@/features/tenants/services/superadmin.client";
import { routes } from "@/constants/routes";
import { TenantForm } from "./TenantForm";
import type { Tenant } from "@/types/domain";

export function SuperadminDashboard({ email }: { email: string | null }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const recargar = useCallback(() => {
    getPlatformMetrics().then(setMetrics).catch(() => setMetrics(null));
    listTenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  useEffect(() => recargar(), [recargar]);

  async function logout() {
    await signOut();
    router.replace(routes.superadminLogin);
    router.refresh();
  }
  async function toggle(t: Tenant) {
    await setTenantActivo(t.id, !t.activo);
    recargar();
  }
  async function eliminar(t: Tenant) {
    if (!confirm(`¿Eliminar "${t.nombre}"? Se borran sus pedidos, menú y staff.`)) return;
    await deleteTenant(t.id);
    recargar();
  }

  const cards = [
    { label: "Locales activos", value: metrics?.tenantsActivos },
    { label: "Pedidos totales", value: metrics?.pedidosTotal },
    { label: "Pedidos hoy", value: metrics?.pedidosHoy },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <span className="font-display text-2xl tracking-widest text-primary">CLICKS · SUPERADMIN</span>
          <p className="text-sm text-muted">{email}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-1 text-sm text-muted hover:text-danger">
          <LogOut className="h-4 w-4" /> Salir
        </button>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">{c.label}</p>
            <p className="font-display text-3xl text-primary">{c.value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Restaurantes</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nuevo restaurante
        </Button>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {tenants.map((t) => (
          <li key={t.id} className="flex items-center gap-3 p-4">
            <span
              className="h-8 w-8 shrink-0 rounded-md border border-border"
              style={{ backgroundColor: t.colorPrimario }}
            />
            <div className="flex-1">
              <p className="font-bold text-text">{t.nombre}</p>
              <p className="text-xs text-muted">/{t.slug}</p>
            </div>
            {!t.activo && <Badge tone="neutral">Inactivo</Badge>}
            <Link
              href={routes.menu(t.slug)}
              target="_blank"
              className="flex items-center gap-1 text-xs text-muted hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" /> Menú
            </Link>
            <button onClick={() => toggle(t)} className="text-xs text-muted underline hover:text-text">
              {t.activo ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={() => {
                setEditing(t);
                setOpen(true);
              }}
              className="p-1 text-muted hover:text-primary"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => eliminar(t)} className="p-1 text-muted hover:text-danger" aria-label="Eliminar">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar restaurante" : "Nuevo restaurante"}
      >
        <TenantForm
          initial={editing}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            recargar();
          }}
        />
      </Modal>
    </div>
  );
}
