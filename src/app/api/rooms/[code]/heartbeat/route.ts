import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { requireUserId } from "@/server/auth";
import { handle, json } from "@/server/http";
import { recordHeartbeat } from "@/server/rooms/service";

export function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/heartbeat">) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { code } = await ctx.params;
    return json(await recordHeartbeat(userId, normalizeRoomCode(code)));
  });
}
