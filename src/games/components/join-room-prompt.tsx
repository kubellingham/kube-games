"use client";

import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { errorMessage } from "../multiplayer/client/api";
import { commitPlayerName, useSavedPlayerName } from "../multiplayer/client/player-name";
import type { RoomPreview } from "../multiplayer/types";
import type { GameDefinition } from "../types";
import { PlayerNameField } from "./player-name-field";

/** Shown when someone opens an invite link for a room they haven't joined yet. */
export function JoinRoomPrompt({
  game,
  code,
  preview,
  lobbyHref,
  onJoin,
}: {
  game: GameDefinition;
  code: string;
  preview: RoomPreview | null;
  lobbyHref: string;
  onJoin: (displayName: string) => Promise<void>;
}) {
  const savedName = useSavedPlayerName();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (preview && preview.status !== "waiting") {
    const finished = preview.status === "finished";
    return (
      <StatePanel
        icon={finished ? "🏁" : "🚫"}
        title={finished ? "This game has finished" : "Room is full"}
        actions={<ButtonLink href={lobbyHref}>Back to lobby</ButtonLink>}
      >
        {finished
          ? "Ask your friend to create a new room."
          : "Both seats are taken. Create your own room or try a quick match."}
      </StatePanel>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await onJoin(commitPlayerName(nameDraft ?? savedName));
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-md animate-fade-up flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center sm:p-8"
    >
      <span aria-hidden className="text-5xl">
        {game.icon}
      </span>
      <div>
        <h2 className="font-display text-2xl font-extrabold">
          {preview?.hostName ? `${preview.hostName} invited you` : "You're invited"} to play {game.name}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Room <span className="font-mono font-bold tracking-wider text-zinc-200">{code}</span>
        </p>
      </div>
      <div className="text-left">
        <PlayerNameField value={nameDraft ?? savedName} onChange={setNameDraft} />
      </div>
      <Button type="submit" size="lg" loading={pending}>
        Join game
      </Button>
      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
      <ButtonLink href={lobbyHref} variant="ghost" size="sm" className="self-center">
        Back to lobby
      </ButtonLink>
    </form>
  );
}
