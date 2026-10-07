import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { GAME_MODES } from "../modes";
import { gameRoutes } from "../routes";
import type { GameDefinition, GameModeId } from "../types";

export function ModeCard({ game, mode }: { game: GameDefinition; mode: GameModeId }) {
  const details = GAME_MODES[mode];
  const features =
    mode === "online"
      ? [game.online?.quickMatch && "⚡ Quick match", game.online?.privateRooms && "🔑 Private rooms"].filter(
          (feature): feature is string => Boolean(feature),
        )
      : [];

  return (
    <Link
      href={gameRoutes.mode(game.id, mode)}
      className="group flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-fuchsia-400/40 hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-fuchsia-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
    >
      <span aria-hidden className="text-5xl transition group-hover:scale-110">
        {details.icon}
      </span>
      <div>
        <h3 className="font-display text-2xl font-bold">{details.label}</h3>
        <p className="mt-1 text-zinc-400">{details.description}</p>
      </div>
      {features.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {features.map((feature) => (
            <li key={feature}>
              <Badge tone="accent">{feature}</Badge>
            </li>
          ))}
        </ul>
      )}
      <span className={buttonClasses({ className: "mt-auto self-start" })}>
        Play {details.label} <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
