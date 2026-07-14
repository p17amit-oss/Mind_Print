// Server-side tracking mirror (BUILD PROMPT Sections 1 & 16). Event names live
// in tracking-const.ts (client-safe); this module owns the Postgres + Pipedream
// mirror and is server-only.
import { query } from "./db";
import { SERVER_ONLY_EVENTS, TRACK_EVENTS, type TrackEventName } from "./tracking-const";

export { SERVER_ONLY_EVENTS, TRACK_EVENTS };
export type { TrackEventName };

export interface TrackPayload {
  name: TrackEventName;
  userId?: string | null;
  sessionId?: string | null;
  params?: Record<string, unknown>;
}

/**
 * Persist to Postgres and forward to Pipedream. Never throws into the request
 * path — analytics must not break gameplay.
 */
export async function recordServerEvent(p: TrackPayload): Promise<void> {
  const { name, userId = null, sessionId = null, params = {} } = p;
  try {
    await query(
      `INSERT INTO track_events (name, user_id, session_id, params)
       VALUES ($1, $2, $3, $4)`,
      [name, userId, sessionId, JSON.stringify(params)]
    );
  } catch (err) {
    console.error("[track] postgres mirror failed", err);
  }

  const hook = process.env.PIPEDREAM_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, userId, sessionId, params, ts: Date.now() }),
      });
    } catch (err) {
      console.error("[track] pipedream forward failed", err);
    }
  }
}
