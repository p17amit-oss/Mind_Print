// Consent & age architecture (BUILD PROMPT Section 3).
// Consent copy lives here as versioned constants. Changing the copy text MUST
// bump the version string — that version is written into consent_records.
import { COVENANT_LINE } from "./compliance";

export type ConsentType =
  | "gameplay_tos"
  | "research_participation"
  | "sponsored_items";

export const AGE_BANDS = ["<18", "18-24", "25-34", "35-44", "45+"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export function isAdultBand(band: AgeBand): boolean {
  return band !== "<18";
}

/** Versioned copy. Bump `version` whenever the body text changes. */
export interface ConsentCopy {
  type: ConsentType;
  version: string;
  title: string;
  body: string[];
  acceptLabel: string;
  declineLabel?: string; // present => decline is a first-class equal-weight button
}

export const GAMEPLAY_TOS: ConsentCopy = {
  type: "gameplay_tos",
  version: "gameplay_tos@2026-01",
  title: "Before you play",
  body: [
    "Mind Print is a daily game. Three quick rounds, about three minutes.",
    "We measure how you play so we can show you your standing among players and how it moves day to day. It is a game, not a clinical or diagnostic instrument.",
    // Covenant line — shown verbatim, do not edit without bumping version.
    COVENANT_LINE,
    "By continuing you accept the terms of service and privacy notice.",
  ],
  acceptLabel: "I'm in",
};

export const RESEARCH_PARTICIPATION: ConsentCopy = {
  type: "research_participation",
  version: "research_participation@2026-01",
  title: "Help the science? (optional)",
  body: [
    "Adults can opt in to let your play join aggregate research on cognition, judgment, and telling real from AI-made.",
    "This is separate from playing. It changes nothing about your game.",
    "You only ever appear inside de-identified aggregates — never as an individual, never exported as you.",
    "You can turn this off anytime in Settings. Turning it off takes effect immediately.",
  ],
  acceptLabel: "Yes, count me in",
  declineLabel: "No thanks",
};

export const SPONSORED_ITEMS: ConsentCopy = {
  type: "sponsored_items",
  version: "sponsored_items@2026-01",
  title: "Sponsored questions",
  body: [
    "Occasionally a Read the Room question may be sponsored. It will always carry a visible “Sponsored” label.",
    "You can opt out of sponsored questions here.",
  ],
  acceptLabel: "That's fine",
  declineLabel: "Opt out",
};

export const CONSENT_COPY: Record<ConsentType, ConsentCopy> = {
  gameplay_tos: GAMEPLAY_TOS,
  research_participation: RESEARCH_PARTICIPATION,
  sponsored_items: SPONSORED_ITEMS,
};

/**
 * Guard: research_participation is grantable ONLY for adults. This mirrors the
 * SQL predicate baked into v_research_eligible_users — enforced in both rooms.
 */
export function canGrantResearch(isAdult: boolean | null): boolean {
  return isAdult === true;
}
