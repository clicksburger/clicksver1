"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui";
import { BrandingForm } from "@/features/tenants/components/BrandingForm";
import { HorariosForm } from "@/features/tenants/components/HorariosForm";
import { EnviosForm } from "@/features/envios/components/EnviosForm";
import { MenuManager } from "@/features/menu/components/MenuManager";
import { CategoriesManager } from "@/features/menu/components/CategoriesManager";
import { PasswordForm } from "@/features/auth/components/PasswordForm";
import type { Tenant } from "@/types/domain";
import { ClicksLogo } from "@/components/ui/ClicksLogo";

type Tab = "branding" | "horarios" | "envios" | "menu" | "categorias" | "password";

export function SettingsTabs({ tenant }: { tenant: Tenant }) {
  const [tab, setTab] = useState<Tab>("branding");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Configuración</h1>
      <Tabs
        className="mb-6"
        value={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          { key: "branding", label: "Identidad" },
          { key: "horarios", label: "Horarios" },
          { key: "envios", label: "Envíos" },
          { key: "menu", label: "Menú" },
          { key: "categorias", label: "Categorías" },
          { key: "password", label: "Contraseña" },
        ]}
      />
      {tab === "branding" &&
        (tenant.slug === "clicks-burger" ? (
          <section className="max-w-lg rounded-xl border border-border bg-surface p-6">
            <div className="mb-6 inline-block rounded-lg bg-black p-4">
              <ClicksLogo />
            </div>
            <h2 className="mb-3 text-xl font-bold">Identidad de Clicks Burger</h2>
            <p className="text-sm leading-relaxed text-muted">
              El sitio utiliza el logo original y una paleta fija para mantener la identidad de
              Clicks en el menú, el ingreso y la administración.
            </p>
            <ul className="mt-5 flex flex-wrap gap-4">
              {[
                { name: "Amarillo", color: "#ffd21c" },
                { name: "Carbón", color: "#131e24" },
                { name: "Crema", color: "#fff8df" },
              ].map((color) => (
                <li key={color.name} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full border border-border"
                    style={{ backgroundColor: color.color }}
                  />
                  {color.name}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <BrandingForm tenant={tenant} />
        ))}
      {tab === "horarios" && <HorariosForm tenant={tenant} />}
      {tab === "envios" && <EnviosForm tenant={tenant} />}
      {tab === "menu" && <MenuManager tenantId={tenant.id} />}
      {tab === "categorias" && <CategoriesManager tenantId={tenant.id} />}
      {tab === "password" && <PasswordForm />}
    </div>
  );
}
