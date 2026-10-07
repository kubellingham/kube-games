import { normalizeRoomCode } from "@/games/multiplayer/rules";
import { requireUserId } from "@/server/auth";
import { handle, json, readJsonObject } from "@/server/http";
import { performAction } from "@/server/rooms/service";

export function POST(request: Request, ctx: RouteContext<"/api/rooms/[code]/actions">) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { code } = await ctx.params;
    const body = await readJsonObject(request);
    return json(await performAction(userId, normalizeRoomCode(code), body.action));
  });
}
