"use client";

import { cn } from "@/lib/cn";

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
  count?: number;
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
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-bold transition",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  active ? "bg-primary text-bg" : "bg-surface3 text-muted",
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
