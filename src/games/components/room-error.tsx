"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import type { RoomApiError } from "../multiplayer/client/api";

const ROOM_ERRORS: Record<string, { icon: string; title: string }> = {
  ROOM_NOT_FOUND: { icon: "🔍", title: "Room not found" },
  ROOM_FULL: { icon: "🚫", title: "Room is full" },
  ROOM_EXPIRED: { icon: "⌛", title: "Room has expired" },
  ROOM_CLOSED: { icon: "🚪", title: "Room closed" },
  INVALID_ROOM_CODE: { icon: "⚠️", title: "Invalid room code" },
  NETWORK_ERROR: { icon: "📡", title: "Can't reach the game server" },
  NOT_CONFIGURED: { icon: "🛠️", title: "Online play isn't set up" },
  AUTH_FAILED: { icon: "🔑", title: "Couldn't sign you in" },
  UNAUTHENTICATED: { icon: "🔑", title: "Session expired" },
};

const RETRYABLE = new Set(["NETWORK_ERROR", "SERVER_ERROR", "AUTH_FAILED", "UNAUTHENTICATED"]);

export function RoomError({
  error,
  lobbyHref,
  onRetry,
}: {
  error: RoomApiError;
  lobbyHref: string;
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);
  const { icon, title } = ROOM_ERRORS[error.code] ?? { icon: "💥", title: "Something went wrong" };
  const retryable = RETRYABLE.has(error.code);

  return (
    <StatePanel
      tone="danger"
      icon={icon}
      title={title}
      actions={
        <>
          {retryable && (
            <Button
              loading={retrying}
              onClick={async () => {
                setRetrying(true);
                await onRetry();
                setRetrying(false);
              }}
            >
              Try again
            </Button>
          )}
          <ButtonLink href={lobbyHref} variant={retryable ? "secondary" : "primary"}>
            Back to lobby
          </ButtonLink>
        </>
      }
    >
      {error.message}
    </StatePanel>
  );
}
