import { after } from "next/server";
import { requireUserId } from "@/server/auth";
import { handle, json, readJsonObject } from "@/server/http";
import { cleanupStaleRooms, quickMatch } from "@/server/rooms/service";

export function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const body = await readJsonObject(request);
    const room = await quickMatch(userId, { gameId: body.gameId, displayName: body.displayName });
    after(cleanupStaleRooms);
    return json(room);
  });
}
