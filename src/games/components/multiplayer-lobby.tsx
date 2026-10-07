"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { GAME_COMPONENTS } from "../game-components";
import { errorMessage, roomsApi } from "../multiplayer/client/api";
import { commitPlayerName, useSavedPlayerName } from "../multiplayer/client/player-name";
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "../multiplayer/rules";
import type { RoomSnapshot } from "../multiplayer/types";
import { gameRoutes } from "../routes";
import type { GameDefinition } from "../types";
import { GameStatus } from "./game-status";
import { PlayerNameField } from "./player-name-field";

type Pending = "quick" | "create" | "join" | null;

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function InlineError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-rose-300">
      {message}
    </p>
  );
}

export function MultiplayerLobby({ game }: { game: GameDefinition }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { RoomOptions, defaultRoomOptions } = GAME_COMPONENTS[game.id] ?? {};

  const savedName = useSavedPlayerName();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? savedName;
  const [options, setOptions] = useState(defaultRoomOptions);
  const [code, setCode] = useState(() => normalizeRoomCode(searchParams.get("code") ?? ""));
  const [pending, setPending] = useState<Pending>(null);
  const [errors, setErrors] = useState<Partial<Record<Exclude<Pending, null>, string>>>({});

  if (!isSupabaseConfigured) {
    return (
      <StatePanel
        icon="🛠️"
        title="Online play isn't set up yet"
        actions={
          <ButtonLink href={gameRoutes.computer(game.id)} variant="secondary">
            Play vs Computer instead
          </ButtonLink>
        }
      >
        Add your Supabase project settings to the environment to enable online multiplayer.
      </StatePanel>
    );
  }

  const run = async (kind: Exclude<Pending, null>, start: (displayName: string) => Promise<RoomSnapshot>) => {
    setPending(kind);
    setErrors({});
    try {
      const room = await start(commitPlayerName(name));
      // Reset before navigating: this page stays mounted (hidden) and may be shown again.
      setPending(null);
      setNameDraft(null);
      router.push(gameRoutes.room(room.gameId, room.code));
    } catch (error) {
      setPending(null);
      setErrors({ [kind]: errorMessage(error) });
    }
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setErrors({ join: "Room codes are 6 letters and numbers, like K7F3QX." });
      return;
    }
    void run("join", (displayName) => roomsApi.join(normalized, displayName));
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <PlayerNameField value={name} onChange={setNameDraft} />
      </section>

      {game.online?.quickMatch && (
        <section className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-linear-to-r from-violet-500/15 to-fuchsia-500/15 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">⚡ Quick match</h2>
              <p className="mt-1 text-sm text-zinc-300">Get paired with the next player who is looking for a game.</p>
            </div>
            <Button size="lg" onClick={() => run("quick", (n) => roomsApi.quickMatch(game.id, n))} loading={pending === "quick"} disabled={pending !== null}>
              Find a match
            </Button>
          </div>
          <div className="mt-3">
            <InlineError message={errors.quick} />
          </div>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Panel
          title="Create a room"
          description={
            game.players.max > 2
              ? `Get a code to share with friends. Start the game once everyone's in (up to ${game.players.max}).`
              : "Get a code to share with a friend. The game starts when they join."
          }
        >
          {RoomOptions && <RoomOptions value={options} onChange={setOptions} disabled={pending !== null} />}
          <Button
            size="lg"
            className="mt-auto"
            onClick={() => run("create", (n) => roomsApi.create(game.id, n, options))}
            loading={pending === "create"}
            disabled={pending !== null}
          >
            Create room
          </Button>
          <InlineError message={errors.create} />
        </Panel>

        <Panel title="Join a room" description="Enter the 6-character code your friend shared with you.">
          <form onSubmit={onJoin} className="flex flex-1 flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="room-code" className="text-sm font-medium text-zinc-300">
                Room code
              </label>
              <input
                id="room-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={ROOM_CODE_LENGTH + 2}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="K7F3QX"
                aria-invalid={Boolean(errors.join) || undefined}
                className="h-14 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-center font-mono text-2xl font-bold tracking-[0.4em] uppercase placeholder:text-zinc-600 focus:border-fuchsia-400/60 focus:outline-none"
              />
            </div>
            <Button type="submit" size="lg" variant="secondary" className="mt-auto" loading={pending === "join"} disabled={pending !== null}>
              Join room
            </Button>
            <InlineError message={errors.join} />
          </form>
        </Panel>
      </div>

      <GameStatus icon="🔒" title="Fair play built in">
        The server referees every match, so hidden moves stay hidden until they are revealed.
      </GameStatus>
    </div>
  );
}
