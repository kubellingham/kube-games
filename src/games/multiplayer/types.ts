export type RoomStatus = "waiting" | "playing" | "finished";

export type RoomEndReason = "completed" | "player_left";

export interface RoomPlayer {
  userId: string;
  seat: number;
  displayName: string;
  isHost: boolean;
  hasLeft: boolean;
}

/** Everything one player is allowed to know about a room. */
export interface RoomSnapshot<State = unknown, Secret = unknown, Options = unknown> {
  id: string;
  code: string;
  gameId: string;
  status: RoomStatus;
  endedReason: RoomEndReason | null;
  isPublic: boolean;
  maxPlayers: number;
  options: Options;
  /** Increases on every change; lets clients ignore out-of-order snapshots. */
  version: number;
  players: RoomPlayer[];
  rematchVotes: string[];
  you: { userId: string; seat: number };
  /** Null until enough players have joined for the game to start. */
  game: { state: State; secret: Secret | null } | null;
}

/** What a non-member may see about a room, e.g. when opening an invite link. */
export interface RoomPreview {
  code: string;
  gameId: string;
  status: RoomStatus;
  hostName: string | null;
  playerCount: number;
  maxPlayers: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; preview?: RoomPreview };
}
