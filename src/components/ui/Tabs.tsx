"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
  count?: number;
  /** Ícono antes del texto. */
  icon?: ReactNode;
  /** Solo el ícono a la vista: el texto queda para lectores de pantalla y el tooltip. */
  soloIcono?: boolean;
  /** Se separa del resto y va al final de la línea. */
  alFinal?: boolean;
  /** Color del activo: "danger" para pestañas como Rechazados. */
  tono?: "danger";
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div className={cn("flex gap-1 border-b border-border", className)} role="tablist">
      {items.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            title={tab.soloIcono ? tab.label : undefined}
            aria-label={tab.soloIcono ? tab.label : undefined}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition",
              tab.alFinal && "ml-auto",
              active
                ? tab.tono === "danger"
                  ? "border-danger text-danger"
                  : "border-primary text-primary"
                : tab.tono === "danger"
                  ? "border-transparent text-muted hover:text-danger"
                  : "border-transparent text-muted hover:text-text",
            )}
          >
            {tab.icon}
            {!tab.soloIcono && tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  active
                    ? tab.tono === "danger"
                      ? "bg-danger text-bg"
                      : "bg-primary text-bg"
                    : "bg-surface3 text-muted",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
