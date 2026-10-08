"use client";

import { useEffect, useEffectEvent } from "react";
import { isRoomApiError } from "./api";

/** Errors meaning a timeout claim is no longer needed. */
const GIVE_UP_CLAIM = new Set(["STALE_TURN", "MATCH_OVER", "GAME_NOT_ACTIVE", "NOT_A_PLAYER", "NOT_IN_ROOM"]);

/**
 * When a turn runs out of time, every player's browser asks the server to play it
 * for the absent player. The server checks the deadline itself and accepts only the
 * first claim. `turnKey` changes whenever the turn moves on; `deadline` is in this
 * device's clock.
 */
export function useTurnTimeoutClaim({
  turnKey,
  deadline,
  enabled,
  claim,
}: {
  turnKey: number;
  deadline: number;
  enabled: boolean;
  claim: () => Promise<void>;
}) {
  const onClaim = useEffectEvent(claim);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const attempt = () => {
      onClaim().catch((e) => {
        // Someone else's claim (or the player's own move) won: the refreshed room moves the turn on.
        if (cancelled || (isRoomApiError(e) && GIVE_UP_CLAIM.has(e.code))) return;
        // Otherwise (a network blip, or this clock running a little fast) try again shortly.
        timer = setTimeout(attempt, 3_000 + Math.random() * 2_000);
      });
    };
    // A little jitter, so the players' claims don't all arrive at once.
    timer = setTimeout(attempt, Math.max(0, deadline - Date.now()) + 300 + Math.random() * 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [turnKey, deadline, enabled]);
}
