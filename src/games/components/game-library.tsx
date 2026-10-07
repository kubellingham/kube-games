"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { cn } from "@/lib/cn";
import type { GameDefinition, GameModeId } from "../types";
import { GameCard } from "./game-card";

type Filter = "all" | GameModeId;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All games" },
  { id: "online", label: "🌐 Online" },
  { id: "computer", label: "🤖 vs Computer" },
];

function matches(game: GameDefinition, query: string, filter: Filter) {
  if (filter !== "all" && !game.modes.includes(filter)) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [game.name, game.tagline, game.category].some((text) => text.toLowerCase().includes(q));
}

export function GameLibrary({ games }: { games: readonly GameDefinition[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const visible = games.filter((game) => matches(game, query, filter));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter games" className="flex flex-wrap gap-2">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-medium ring-1 ring-inset transition",
                filter === id
                  ? "bg-white text-ink-950 ring-white"
                  : "bg-white/[0.04] text-zinc-300 ring-white/10 hover:bg-white/10 hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">Search games</span>
          <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games"
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pr-4 pl-10 text-sm placeholder:text-zinc-500 focus:border-fuchsia-400/60 focus:outline-none"
          />
        </label>
      </div>

      {visible.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((game) => (
            <li key={game.id} className="flex">
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      ) : (
        <StatePanel
          icon="🕹️"
          title="No games match"
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              Clear filters
            </Button>
          }
        >
          Try a different search or filter.
        </StatePanel>
      )}
    </div>
  );
}
