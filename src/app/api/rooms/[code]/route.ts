import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { requireUserId } from "@/server/auth";
import { handle, json } from "@/server/http";
import { getRoom } from "@/server/rooms/service";

export function GET(request: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { code } = await ctx.params;
    return json(await getRoom(userId, normalizeRoomCode(code)));
  });
}
