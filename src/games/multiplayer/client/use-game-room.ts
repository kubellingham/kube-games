"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { HEARTBEAT_INTERVAL_MS } from "../rules";
import type { RoomPreview, RoomSnapshot } from "../types";
import { isRoomApiError, RoomApiError, roomsApi } from "./api";

export type RoomLoadState<State, Secret, Options> =
  | { phase: "loading" }
  /** The player isn't in the room yet, e.g. they opened an invite link. */
  | { phase: "join"; preview: RoomPreview | null }
  | { phase: "error"; error: RoomApiError }
  | { phase: "ready"; room: RoomSnapshot<State, Secret, Options> };

/** "live" means Realtime is connected; otherwise the hook polls as a fallback. */
export type ConnectionStatus = "connecting" | "live" | "reconnecting";

const POLL_INTERVAL_MS = 4_000;

/**
 * Keeps a room snapshot in sync with the server.
 *
 * The server is the source of truth. Realtime only tells us *that* the room
 * changed (a row update the player is allowed to see); we then fetch this
 * player's own view of the room, which never contains other players' secrets.
 *
 * Realtime can drop change events (e.g. while the server restarts replication)
 * without the socket disconnecting, so heartbeats double as a version check.
 */
export function useGameRoom<State = unknown, Secret = unknown, Options = unknown>(code: string) {
  const [load, setLoad] = useState<RoomLoadState<State, Secret, Options>>({ phase: "loading" });
  const [realtime, setRealtime] = useState<ConnectionStatus>("connecting");
  // Set when the game server itself can't be reached; cleared by the next successful request.
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const connection: ConnectionStatus = serverUnreachable ? "reconnecting" : realtime;
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string> | null>(null);

  const latest = useRef<{ id: string; version: number } | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const refreshQueued = useRef(false);

  const applySnapshot = useCallback((room: RoomSnapshot) => {
    const current = latest.current;
    // Responses can arrive out of order; never replace a newer view with an older one.
    if (current && current.id === room.id && room.version < current.version) return;
    latest.current = { id: room.id, version: room.version };
    setLoad({ phase: "ready", room: room as RoomSnapshot<State, Secret, Options> });
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      applySnapshot(await roomsApi.get(code));
      setServerUnreachable(false);
    } catch (error) {
      const apiError = isRoomApiError(error)
        ? error
        : new RoomApiError("SERVER_ERROR", "Something went wrong. Please try again.", 0);
      if (apiError.code === "NETWORK_ERROR" || apiError.status >= 500) {
        setServerUnreachable(true);
        // A transient failure: keep showing the last known state and retry.
        setLoad((prev) => (prev.phase === "ready" ? prev : { phase: "error", error: apiError }));
      } else if (apiError.code === "NOT_IN_ROOM") {
        setLoad({ phase: "join", preview: apiError.preview ?? null });
      } else {
        setLoad({ phase: "error", error: apiError });
      }
    }
  }, [code, applySnapshot]);

  /** Fetches the latest snapshot. Calls made while a fetch is running are coalesced into one more fetch. */
  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) {
      refreshQueued.current = true;
      return inFlight.current;
    }
    inFlight.current = (async () => {
      do {
        refreshQueued.current = false;
        await fetchSnapshot();
      } while (refreshQueued.current);
    })().finally(() => {
      inFlight.current = null;
    });
    return inFlight.current;
  }, [fetchSnapshot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const roomId = load.phase === "ready" ? load.room.id : null;
  const userId = load.phase === "ready" ? load.room.you.userId : null;
  const isSeated =
    load.phase === "ready" && !load.room.players.some((p) => p.userId === load.room.you.userId && p.hasLeft);

  // Realtime: room change notifications + presence (who has the room open right now).
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!roomId || !userId || !supabase) return;

    const channel = supabase.channel(`game-room:${roomId}`, { config: { presence: { key: userId } } });
    channel
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const version = (payload.new as { version?: unknown }).version;
          if (typeof version !== "number" || version > (latest.current?.version ?? 0)) void refresh();
        },
      )
      .on("system", {}, (payload: { extension?: string; status?: string }) => {
        // Change events only flow once Postgres replication is ready; catch up on anything before that.
        if (payload.extension === "postgres_changes" && payload.status === "ok") void refresh();
      })
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtime("live");
          void channel.track({ online: true });
          // Catch up on anything that changed while we were (re)connecting.
          void refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtime("reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId, refresh]);

  // Fallback while Realtime is unavailable: poll.
  useEffect(() => {
    if (!roomId || connection === "live") return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [roomId, connection, refresh]);

  // Resync when the tab becomes visible again or the network comes back.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [refresh]);

  // Heartbeats tell the server this player still has the room open, and reveal missed updates.
  useEffect(() => {
    if (!roomId || !isSeated) return;
    const beat = () =>
      roomsApi
        .heartbeat(code)
        .then(({ version }) => {
          setServerUnreachable(false);
          if (version > (latest.current?.version ?? 0)) void refresh();
        })
        .catch((error) => {
          if (!isRoomApiError(error)) return;
          if (error.code === "NETWORK_ERROR" || error.status >= 500) setServerUnreachable(true);
          if (error.code === "NOT_IN_ROOM") void refresh();
        });
    void beat();
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [roomId, isSeated, code, refresh]);

  const join = useCallback(
    async (displayName: string) => applySnapshot(await roomsApi.join(code, displayName)),
    [code, applySnapshot],
  );

  const act = useCallback(
    async (action: unknown) => {
      try {
        applySnapshot(await roomsApi.act(code, action));
      } catch (error) {
        void refresh(); // The action was rejected; make sure we show the server's state.
        throw error;
      }
    },
    [code, applySnapshot, refresh],
  );

  const rematch = useCallback(async () => applySnapshot(await roomsApi.rematch(code)), [code, applySnapshot]);

  const leave = useCallback(() => roomsApi.leave(code), [code]);

  return { load, connection, onlineIds, refresh, join, act, rematch, leave };
}

export type GameRoomController<State = unknown, Secret = unknown, Options = unknown> = ReturnType<
  typeof useGameRoom<State, Secret, Options>
>;
