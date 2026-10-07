"use client";

import type { RoomOptionsProps } from "../../game-components";
import { DEFAULT_RPS_OPTIONS, RPS_TARGET_SCORE_CHOICES, type RpsOptions } from "../multiplayer/types";

function currentTarget(value: unknown): number | null {
  const options = value as Partial<RpsOptions> | null | undefined;
  return options && "targetScore" in options ? (options.targetScore ?? null) : DEFAULT_RPS_OPTIONS.targetScore;
}

export function RoomOptions({ value, onChange, disabled }: RoomOptionsProps) {
  const target = currentTarget(value);
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-zinc-300">Match length</legend>
      <div className="grid grid-cols-3 gap-2">
        {RPS_TARGET_SCORE_CHOICES.map((choice) => (
          <label
            key={String(choice)}
            className="flex h-11 cursor-pointer items-center justify-center rounded-xl bg-white/[0.04] text-sm font-medium text-zinc-300 ring-1 ring-white/10 transition ring-inset hover:bg-white/10 has-checked:bg-white has-checked:text-ink-950 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white/80"
          >
            <input
              type="radio"
              name="rps-target-score"
              className="sr-only"
              checked={choice === target}
              onChange={() => onChange({ targetScore: choice } satisfies RpsOptions)}
            />
            {choice === null ? "Endless" : `First to ${choice}`}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
