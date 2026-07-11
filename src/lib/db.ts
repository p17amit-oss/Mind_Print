// Neon Postgres access via @vercel/postgres (BUILD PROMPT Section 1).
// All user/event/run data flows through here.
//
// Two-room-wall note: this module exposes generic query helpers, but there is
// deliberately NO helper that exports user-level rows to the outside world.
// Cross-user reads must go through the SQL research views (migrations/0003).
import { sql, createPool, type QueryResult, type QueryResultRow } from "@vercel/postgres";

export { sql };

/** Shared pool. @vercel/postgres reads POSTGRES_URL from the environment. */
export const pool = createPool();

/**
 * Run a parameterized query and return typed rows.
 * Uses $1, $2… placeholders (node-postgres style).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as (string | number | boolean | null)[]);
}

/** Convenience: first row or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const res = await query<T>(text, params);
  return res.rows[0] ?? null;
}
