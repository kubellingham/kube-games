import { Spinner } from "@/components/ui/spinner";

export function GameLoading({ label = "Loading game…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="grid min-h-72 place-items-center rounded-3xl border border-white/10 bg-white/[0.03] text-zinc-400"
    >
      <span className="flex items-center gap-3 text-sm">
        <Spinner className="size-5" /> {label}
      </span>
    </div>
  );
}
