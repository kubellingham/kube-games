import Link from "next/link";
import { gameRoutes } from "@/games/routes";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href={gameRoutes.library}
          className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-lg shadow-lg shadow-fuchsia-500/30 transition group-hover:rotate-6">
            🎮
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            Kube <span className="text-fuchsia-300">Games</span>
          </span>
        </Link>
        <nav aria-label="Main">
          <Link
            href={gameRoutes.library}
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            Game Library
          </Link>
        </nav>
      </div>
    </header>
  );
}
