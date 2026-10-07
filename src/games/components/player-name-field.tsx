"use client";

import { DISPLAY_NAME_MAX_LENGTH } from "../multiplayer/rules";

export function PlayerNameField({
  value,
  onChange,
  id = "player-name",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-zinc-300">
        Your name
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder="Leave blank for a random name"
        className="h-12 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-base placeholder:text-zinc-500 focus:border-fuchsia-400/60 focus:outline-none"
      />
    </div>
  );
}
