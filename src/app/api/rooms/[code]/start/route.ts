import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { requireUserId } from "@/server/auth";
import { handle, json } from "@/server/http";
import { startGame } from "@/server/rooms/service";

export function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/start">) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { code } = await ctx.params;
    return json(await startGame(userId, normalizeRoomCode(code)));
  });
}
