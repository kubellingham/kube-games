import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { requireUserId } from "@/server/auth";
import { handle } from "@/server/http";
import { leaveRoom } from "@/server/rooms/service";

export function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/leave">) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { code } = await ctx.params;
    await leaveRoom(userId, normalizeRoomCode(code));
    return new Response(null, { status: 204 });
  });
}
