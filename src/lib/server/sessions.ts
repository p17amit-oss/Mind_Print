// Session persistence (BUILD PROMPT Section 2/4). One session per user per day.
import { query, queryOne } from "../db";
import type { TrialType } from "../trials";

export interface SessionRow {
  id: string;
  user_id: string;
  session_date: string;
  completed: boolean;
  context_tags: string[] | null;
  trials_planned: TrialType[] | null;
}

/** Server-local "today" in UTC (session_date is a DATE). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get or create today's session for a user. `planned` is written only on first
 * creation (the rotation planner in Step 7 supplies it).
 */
export async function getOrCreateTodaySession(
  userId: string,
  planned?: TrialType[]
): Promise<SessionRow> {
  const date = todayISO();
  const existing = await queryOne<SessionRow>(
    `SELECT id, user_id, session_date::text, completed, context_tags, trials_planned
       FROM sessions WHERE user_id = $1 AND session_date = $2`,
    [userId, date]
  );
  if (existing) return existing;

  const created = await queryOne<SessionRow>(
    `INSERT INTO sessions (user_id, session_date, trials_planned, started_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, session_date) DO UPDATE SET started_at = COALESCE(sessions.started_at, now())
     RETURNING id, user_id, session_date::text, completed, context_tags, trials_planned`,
    [userId, date, planned ? JSON.stringify(planned) : null]
  );
  return created!;
}

export async function getTodaySession(userId: string): Promise<SessionRow | null> {
  return queryOne<SessionRow>(
    `SELECT id, user_id, session_date::text, completed, context_tags, trials_planned
       FROM sessions WHERE user_id = $1 AND session_date = $2`,
    [userId, todayISO()]
  );
}

export async function completeSession(
  sessionId: string,
  contextTags: string[] | null
): Promise<void> {
  await query(
    `UPDATE sessions SET completed = true, completed_at = now(),
       context_tags = $2
     WHERE id = $1`,
    [sessionId, contextTags && contextTags.length ? contextTags : null]
  );
}

/** Count of completed sessions for a user (used for Chest cadence, Section 5). */
export async function completedSessionCount(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM sessions WHERE user_id = $1 AND completed = true`,
    [userId]
  );
  return Number(row?.n ?? 0);
}
