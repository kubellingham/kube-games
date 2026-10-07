import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { GAME_MODES } from "../modes";
import { formatPlayerCount } from "../registry";
import { gameRoutes } from "../routes";
import type { GameDefinition } from "../types";
import { THEME_STYLES } from "./theme";

export function FeaturedGame({ game }: { game: GameDefinition }) {
  const theme = THEME_STYLES[game.theme];
  return (
    <section
      aria-labelledby="featured-game"
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-ink-900"
    >
      <div aria-hidden className={cn("absolute inset-0 bg-linear-to-br opacity-25", theme.gradient)} />
      <div
        aria-hidden
        className="absolute -top-24 -right-24 size-80 rounded-full bg-fuchsia-500/30 blur-3xl"
      />
      <div className="relative grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className={cn("text-xs font-semibold tracking-wider uppercase", theme.text)}>Featured game</p>
          <h2 id="featured-game" className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {game.name}
          </h2>
          <p className="mt-3 max-w-lg text-zinc-300">{game.description}</p>
          <p className="mt-3 text-sm text-zinc-400">
            👥 {formatPlayerCount(game.players)} · {game.modes.map((m) => GAME_MODES[m].label).join(" · ")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {game.modes.map((mode, index) => (
              <ButtonLink
                key={mode}
                href={gameRoutes.mode(game.id, mode)}
                variant={index === 0 ? "primary" : "secondary"}
                size="lg"
              >
                <span aria-hidden>{GAME_MODES[mode].icon}</span> Play {GAME_MODES[mode].label}
              </ButtonLink>
            ))}
          </div>
        </div>
        <div aria-hidden className="hidden justify-center gap-4 text-6xl sm:flex md:text-7xl">
          {(game.showcase ?? [game.icon]).map((emoji, i) => (
            <span
              key={emoji}
              className="grid size-24 place-items-center rounded-3xl border border-white/15 bg-white/10 shadow-xl backdrop-blur md:size-28"
              style={{ animation: `float 3.2s ease-in-out ${i * 0.4}s infinite` }}
            >
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
