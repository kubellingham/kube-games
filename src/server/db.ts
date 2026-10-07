import "server-only";
import { Pool, type PoolClient } from "pg";
import { ApiError } from "./http";

declare global {
  var __kubeGamesPool: Pool | undefined;
}

export type Db = PoolClient;

/**
 * DATABASE_URL, with its credentials optionally replaced by DATABASE_USER and
 * DATABASE_PASSWORD. Keeping the password out of the URL means it never needs
 * URL-encoding, so symbols in it can't break the connection string.
 */
function resolveConnectionString(): string | undefined {
  const url = process.env.DATABASE_URL;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  if (!url || (!user && !password)) return url;
  const parsed = new URL(url);
  if (user) parsed.username = encodeURIComponent(user);
  if (password) parsed.password = encodeURIComponent(password);
  return parsed.toString();
}

export function getPool(): Pool {
  if (!globalThis.__kubeGamesPool) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new ApiError(503, "NOT_CONFIGURED", "Online play isn't set up on this server yet.");
    }
    const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
    const pool = new Pool({
      connectionString,
      // Always encrypt traffic to a remote database. Supabase signs its certificates with
      // its own CA, so the chain isn't verified here; add `sslmode=verify-full` (plus the
      // CA) to the URL for full verification, which takes precedence over this default.
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    // Idle clients can error when the database restarts; don't crash the process.
    pool.on("error", (error) => console.error("Postgres pool error", error));
    // Reuse one pool across hot reloads in development.
    globalThis.__kubeGamesPool = pool;
  }
  return globalThis.__kubeGamesPool;
}

interface TransactionOptions {
  readOnly?: boolean;
}

export async function withTransaction<T>(
  fn: (db: Db) => Promise<T>,
  { readOnly = false }: TransactionOptions = {},
): Promise<T> {
  const client = await getPool().connect();
  let releaseError: Error | undefined;
  try {
    // Read-only snapshots use REPEATABLE READ so every query sees the same data.
    await client.query(readOnly ? "begin isolation level repeatable read read only" : "begin");
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '10s'");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch((rollbackError: Error) => {
      releaseError = rollbackError;
    });
    throw error;
  } finally {
    // Passing an error destroys the connection instead of returning it to the pool.
    client.release(releaseError);
  }
}
