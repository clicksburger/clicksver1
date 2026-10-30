import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "primary" | "success" | "danger" | "info" | "warning";

/**
 * Chips de estado. Texto de color sobre surface (sin modificadores de
 * opacidad, que no funcionan con tokens en hex vía variables CSS).
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface3 text-muted",
  primary: "bg-surface3 text-primary",
  success: "bg-surface3 text-success",
  danger: "bg-surface3 text-danger",
  info: "bg-surface3 text-info",
  warning: "bg-surface3 text-primary-soft",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
