// Tracking event names (BUILD PROMPT Section 16). Exact names — do not rename.
// Client-safe module (no node/db imports); the server mirror lives in tracking.ts.
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
