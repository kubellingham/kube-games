"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ApiErrorBody, RoomPreview, RoomSnapshot } from "../types";

export class RoomApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly preview?: RoomPreview,
  ) {
    super(message);
    this.name = "RoomApiError";
  }
}

export const isRoomApiError = (error: unknown): error is RoomApiError => error instanceof RoomApiError;

export function errorMessage(error: unknown): string {
  return isRoomApiError(error) ? error.message : "Something went wrong. Please try again.";
}

let signingIn: Promise<string> | null = null;

/**
 * Returns an access token for this browser's player, signing in anonymously the
 * first time. The session persists in localStorage, so a refresh keeps the same
 * player identity (and therefore the same seat in a room).
 */
async function getAccessToken(forceRefresh = false): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new RoomApiError("NOT_CONFIGURED", "Online play isn't set up yet. Add the Supabase settings to enable it.", 0);
  }

  if (forceRefresh) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) return data.session.access_token;
  } else {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.access_token;
  }

  // Share one sign-in between concurrent callers so we don't create two players.
  signingIn ??= supabase.auth
    .signInAnonymously()
    .then(({ data, error }) => {
      if (error || !data.session) {
        throw new RoomApiError(
          "AUTH_FAILED",
          "We couldn't connect you to the game server. Check your connection and try again.",
          error?.status ?? 0,
        );
      }
      return data.session.access_token;
    })
    .finally(() => {
      signingIn = null;
    });
  return signingIn;
}

async function request<T>(path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getAccessToken(retried);
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new RoomApiError("NETWORK_ERROR", "Can't reach the game server. Check your connection.", 0);
  }

  if (response.status === 401 && !retried) return request<T>(path, body, true);
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new RoomApiError(
      error?.code ?? "SERVER_ERROR",
      error?.message ?? "Something went wrong on our side. Please try again.",
      response.status,
      error?.preview,
    );
  }
  return data as T;
}

const roomPath = (code: string, action = "") => `/api/rooms/${encodeURIComponent(code)}${action}`;

export const roomsApi = {
  create: (gameId: string, displayName: string, options?: unknown) =>
    request<RoomSnapshot>("/api/rooms", { gameId, displayName, options }),
  quickMatch: (gameId: string, displayName: string) =>
    request<RoomSnapshot>("/api/rooms/quick-match", { gameId, displayName }),
  get: (code: string) => request<RoomSnapshot>(roomPath(code)),
  join: (code: string, displayName: string) => request<RoomSnapshot>(roomPath(code, "/join"), { displayName }),
  act: (code: string, action: unknown) => request<RoomSnapshot>(roomPath(code, "/actions"), { action }),
  rematch: (code: string) => request<RoomSnapshot>(roomPath(code, "/rematch"), {}),
  leave: (code: string) => request<void>(roomPath(code, "/leave"), {}),
  heartbeat: (code: string) => request<{ version: number }>(roomPath(code, "/heartbeat"), {}),
};
