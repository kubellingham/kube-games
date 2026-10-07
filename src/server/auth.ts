import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { ApiError } from "./http";

let authClient: SupabaseClient | undefined;

function getAuthClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new ApiError(503, "NOT_CONFIGURED", "Online play isn't set up on this server yet.");
  }
  authClient ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return authClient;
}

const SESSION_EXPIRED = "Your session has expired. Refresh the page to reconnect.";

/**
 * Returns the id of the Supabase user who sent the request. The id always comes
 * from a verified JWT, never from the request body.
 */
export async function requireUserId(request: Request): Promise<string> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new ApiError(401, "UNAUTHENTICATED", SESSION_EXPIRED);

  // Verifies the signature locally (asymmetric signing keys) or with the Auth server.
  const { data, error } = await getAuthClient().auth.getClaims(match[1]);
  const userId = data?.claims.sub;
  if (error || data?.claims.role !== "authenticated" || typeof userId !== "string" || !userId) {
    throw new ApiError(401, "UNAUTHENTICATED", SESSION_EXPIRED);
  }
  return userId;
}
