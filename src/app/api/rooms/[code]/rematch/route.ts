import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { requireUserId } from "@/server/auth";
import { handle, json } from "@/server/http";
import { requestRematch } from "@/server/rooms/service";

export function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/rematch">) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { code } = await ctx.params;
    return json(await requestRematch(userId, normalizeRoomCode(code)));
  });
}
