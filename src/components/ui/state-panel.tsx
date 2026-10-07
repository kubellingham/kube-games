import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A centered message for loading, empty and error states. */
export function StatePanel({
  icon,
  title,
  children,
  actions,
  tone = "neutral",
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "mx-auto flex w-full max-w-md animate-fade-up flex-col items-center rounded-3xl border bg-white/[0.03] px-6 py-10 text-center",
        tone === "danger" ? "border-rose-400/20" : "border-white/10",
        className,
      )}
    >
      <div className="mb-4 text-5xl" aria-hidden>
        {icon}
      </div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children && <div className="mt-2 text-sm text-zinc-400">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
