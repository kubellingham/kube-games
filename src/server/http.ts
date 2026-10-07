import "server-only";
import { GameRuleError } from "@/games/multiplayer/engine";
import type { ApiErrorBody, RoomPreview } from "@/games/multiplayer/types";

/** An expected failure with a message that is safe to show to the player. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly preview?: RoomPreview,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorBody(code: string, message: string, preview?: RoomPreview): ApiErrorBody {
  return { error: preview ? { code, message, preview } : { code, message } };
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(errorBody(error.code, error.message, error.preview), {
      status: error.status,
      headers: NO_STORE,
    });
  }
  if (error instanceof GameRuleError) {
    const status = error.code.startsWith("INVALID_") ? 400 : 409;
    return Response.json(errorBody(error.code, error.message), { status, headers: NO_STORE });
  }
  console.error("Unhandled API error", error);
  return Response.json(
    errorBody("SERVER_ERROR", "Something went wrong on our side. Please try again."),
    { status: 500, headers: NO_STORE },
  );
}

/** Runs a handler and converts thrown errors into JSON error responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Every game request is tiny; refuse anything larger instead of parsing it.
const MAX_BODY_BYTES = 16 * 1024;

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const tooLarge = new ApiError(413, "PAYLOAD_TOO_LARGE", "That request is too large.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw tooLarge;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw tooLarge;

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_REQUEST", "The request body must be JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_REQUEST", "The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}
