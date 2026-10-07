import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { GAME_MODES } from "../modes";
import { gameRoutes } from "../routes";
import type { GameDefinition, GameModeId } from "../types";
import { THEME_STYLES } from "./theme";

/** Page frame for a game: breadcrumb back to the library, title, and mode switcher. */
export function GameShell({
  game,
  mode,
  showModeSwitch = true,
  children,
}: {
  game: GameDefinition;
  mode?: GameModeId;
  showModeSwitch?: boolean;
  children: ReactNode;
}) {
  const theme = THEME_STYLES[game.theme];
  const otherModes = mode && showModeSwitch ? game.modes.filter((m) => m !== mode) : [];

  return (
    <div className="flex flex-1 flex-col gap-6 pt-6 sm:pt-8">
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href={gameRoutes.library} className="rounded transition hover:text-white">
              ← Library
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            {mode ? (
              <Link href={gameRoutes.game(game.id)} className="rounded transition hover:text-white">
                {game.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-zinc-200">
                {game.name}
              </span>
            )}
          </li>
          {mode && (
            <>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-zinc-200">
                {GAME_MODES[mode].label}
              </li>
            </>
          )}
        </ol>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-3xl shadow-lg",
              theme.gradient,
              theme.glow,
            )}
          >
            {game.icon}
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{game.name}</h1>
            {mode && (
              <p className="text-sm text-zinc-400">
                {GAME_MODES[mode].icon} {GAME_MODES[mode].label}
              </p>
            )}
          </div>
        </div>
        {otherModes.length > 0 && (
          <div className="flex gap-2">
            {otherModes.map((m) => (
              <ButtonLink key={m} href={gameRoutes.mode(game.id, m)} variant="secondary" size="sm">
                {GAME_MODES[m].icon} Switch to {GAME_MODES[m].label}
              </ButtonLink>
            ))}
          </div>
        )}
      </header>

      {children}
    </div>
  );
}
