import { cn } from "@/lib/cn";

export type Connection = "online" | "offline" | "unknown";

export function PlayerAvatar({ name, connection = "unknown", className }: { name: string; connection?: Connection; className?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-zinc-600 to-zinc-800 font-display text-base font-bold ring-2 ring-white/10", className)}>
      {initial}
      {connection !== "unknown" && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-ink-950",
            connection === "online" ? "bg-emerald-400" : "bg-zinc-500",
          )}
        >
          <span className="sr-only">{connection === "online" ? "Online" : "Offline"}</span>
        </span>
      )}
    </span>
  );
}

/** A player's avatar, name and current status ("Choosing…", "Locked in", ...). */
export function PlayerIndicator({
  name,
  isYou = false,
  status,
  statusTone = "neutral",
  connection,
  align = "left",
}: {
  name: string;
  isYou?: boolean;
  status?: string;
  statusTone?: "neutral" | "success" | "warning";
  connection?: Connection;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <PlayerAvatar name={name} connection={connection} className={isYou ? "from-violet-500 to-fuchsia-500" : undefined} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {name}
          {isYou && name !== "You" && <span className="ml-1.5 text-xs font-medium text-fuchsia-300">(you)</span>}
        </p>
        {status && (
          <p
            className={cn(
              "truncate text-xs",
              statusTone === "success" && "text-emerald-300",
              statusTone === "warning" && "text-amber-200",
              statusTone === "neutral" && "text-zinc-400",
            )}
          >
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
