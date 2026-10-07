import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  info: "border-white/10 bg-white/[0.04] text-zinc-100",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  danger: "border-rose-400/25 bg-rose-400/10 text-rose-100",
};

/** A one-line game status message, announced to screen readers when it changes. */
export function GameStatus({
  tone = "info",
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", TONES[tone], className)}
    >
      {icon && (
        <span aria-hidden className="text-xl">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <p className="text-sm opacity-80">{children}</p>}
      </div>
    </div>
  );
}
