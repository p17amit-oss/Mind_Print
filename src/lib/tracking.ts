// Tracking events (BUILD PROMPT Section 16). Exact names — do not rename.
// Fired to GA4 (client, gtag) and mirrored server-side (/api/track → Postgres +
// Pipedream). `fooled_call` is server-side only and must never carry PII.
import { query } from "./db";

export const TRACK_EVENTS = {
  session_start: "session_start",
  wager_placed: "wager_placed", // {trial, stake}
  trial_complete: "trial_complete", // {trial, chaos}
  fooled_call: "fooled_call", // {tier, modality, correct} — SERVER-SIDE ONLY, no PII
  double_or_bank: "double_or_bank", // {chose}
  chest_choice: "chest_choice", // {chose}
  context_tags: "context_tags", // {tags}
  session_complete: "session_complete",
  form_viewed: "form_viewed", // {dimension, form}
  fog_clear_viewed: "fog_clear_viewed", // {dimension, delta}
  card_generated: "card_generated",
  card_shared: "card_shared", // {method, card_version}
  share_landing: "share_landing", // {card_version, share_id}
  research_consent: "research_consent", // {granted|declined|revoked}
  gauntlet_participation: "gauntlet_participation", // {event_id}
  bonus_trial: "bonus_trial", // {trial}
} as const;

export type TrackEventName = keyof typeof TRACK_EVENTS;

/** Events that must be recorded server-side only (never emitted from client). */
export const SERVER_ONLY_EVENTS: TrackEventName[] = ["fooled_call"];

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
