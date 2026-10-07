import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { GameLoading } from "./components/game-loading";
import type { RoomSnapshot } from "./multiplayer/types";
import { DEFAULT_RPS_OPTIONS } from "./rock-paper-scissors/multiplayer/types";

export interface OnlineGameProps {
  room: RoomSnapshot;
  act: (action: unknown) => Promise<void>;
  rematch: () => Promise<void>;
  /** Players who currently have the room open, or null until presence is known. */
  onlineIds: ReadonlySet<string> | null;
  /** Leaves the room (notifying the other players) and returns to the lobby. */
  leave: () => void;
}

export interface RoomOptionsProps {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export interface GameComponents {
  /** Solo play against the computer ("computer" mode). */
  Computer?: ComponentType;
  /** Online play ("online" mode), rendered once the room's game has started. */
  Online?: ComponentType<OnlineGameProps>;
  /** Settings offered when creating a private room. */
  RoomOptions?: ComponentType<RoomOptionsProps>;
  defaultRoomOptions?: unknown;
}

const loading = () => <GameLoading />;

/**
 * UI for each game, keyed by game id. Components are loaded lazily, so the
 * library and other games never download a game's code until it is played.
 */
export const GAME_COMPONENTS: Readonly<Record<string, GameComponents>> = {
  "rock-paper-scissors": {
    Computer: dynamic(
      () => import("./rock-paper-scissors/components/computer-game").then((m) => m.ComputerGame),
      { loading },
    ),
    Online: dynamic(() => import("./rock-paper-scissors/components/online-game").then((m) => m.OnlineGame), {
      loading,
    }),
    RoomOptions: dynamic(() => import("./rock-paper-scissors/components/room-options").then((m) => m.RoomOptions)),
    defaultRoomOptions: DEFAULT_RPS_OPTIONS,
  },
};
