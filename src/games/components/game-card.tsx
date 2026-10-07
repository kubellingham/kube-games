import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { GAME_MODES } from "../modes";
import { formatPlayerCount } from "../registry";
import { gameRoutes } from "../routes";
import type { GameDefinition } from "../types";
import { THEME_STYLES } from "./theme";

export function GameCard({ game }: { game: GameDefinition }) {
  const theme = THEME_STYLES[game.theme];
  const available = game.availability === "available";

  return (
    <article
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition duration-300",
        available && "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] hover:shadow-2xl",
        available && theme.glow,
      )}
    >
      <div
        className={cn(
          "relative grid aspect-[16/9] place-items-center overflow-hidden bg-linear-to-br",
          theme.gradient,
          !available && "opacity-40 grayscale",
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.35),transparent_45%)]"
        />
        <span
          aria-hidden
          className="relative text-7xl drop-shadow-[0_10px_20px_rgb(0_0_0/0.35)] transition duration-300 group-hover:scale-110 group-hover:-rotate-6"
        >
          {game.icon}
        </span>
      </div>

      <div className="absolute inset-x-3 top-3 flex justify-between">
        <Badge tone={available ? "success" : "warning"} className="bg-ink-950/70 backdrop-blur">
          {available ? "● Live" : "Coming soon"}
        </Badge>
        <Badge className="bg-ink-950/70 backdrop-blur">👥 {formatPlayerCount(game.players)}</Badge>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-wider", theme.text)}>{game.category}</p>
          <h3 className="mt-1 font-display text-xl font-bold">{game.name}</h3>
          <p className="mt-1 text-sm text-zinc-400">{game.tagline}</p>
        </div>

        <ul className="flex flex-wrap gap-2" aria-label="Game modes">
          {game.modes.map((mode) => (
            <li key={mode}>
              <Badge>
                <span aria-hidden>{GAME_MODES[mode].icon}</span> {GAME_MODES[mode].label}
              </Badge>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-1">
          {available ? (
            <ButtonLink href={gameRoutes.game(game.id)} className="w-full" aria-label={`Play ${game.name}`}>
              Play
            </ButtonLink>
          ) : (
            <span aria-disabled className={buttonClasses({ variant: "secondary", className: "w-full opacity-60" })}>
              Coming soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
