// Compliance guardrails (BUILD PROMPT Section 13).
// Encoded as constants + enforced by scripts/compliance-grep.ts and
// tests/compliance/*. Changing these changes what CI rejects.

/**
 * Banned anywhere in player-facing UI / cards / meta. Case-insensitive,
 * whole-phrase. Mind Print measures how you play — it is never framed as an
 * intelligence test, training program, or clinical/diagnostic instrument.
 */
export const BANNED_UI_STRINGS: string[] = [
  "IQ",
  "intelligence quotient",
  "cognitive training",
  "brain training",
  "improve your brain",
  "improve your memory",
  "improve your intelligence",
  "diagnose",
  "diagnosis",
  "clinical",
];

/**
 * Banned specifically in Form copy templates (Section 8 language law). Form is
 * athlete's vocabulary — a bad day is form, not fate. Never trait/health language.
 */
export const BANNED_FORM_STRINGS: string[] = [
  "decline",
  "impairment",
  "your memory is getting worse",
];

/** Required framing footer on the profile (Section 13). */
export const PROFILE_FOOTER =
  "Mind Print measures how you play. It is a game, not a clinical or diagnostic instrument.";

/** The covenant line, shown verbatim in the gameplay ToS (Section 3). */
export const COVENANT_LINE = "Institutions see populations. Never people.";

/** The Form onboarding law line (Section 8). */
export const FORM_LAW_LINE = "Form moves daily. Your print doesn't.";

export interface ComplianceHit {
  phrase: string;
  index: number;
}

/**
 * Scan text for banned phrases. `scope` selects which banned list applies.
 * Returns every hit so callers/tests can report precisely.
 */
export function scanForBanned(
  text: string,
  scope: "ui" | "form" = "ui"
): ComplianceHit[] {
  const banned = scope === "form" ? [...BANNED_UI_STRINGS, ...BANNED_FORM_STRINGS] : BANNED_UI_STRINGS;
  const hay = text.toLowerCase();
  const hits: ComplianceHit[] = [];
  for (const phrase of banned) {
    const needle = phrase.toLowerCase();
    let from = 0;
    for (;;) {
      const idx = hay.indexOf(needle, from);
      if (idx === -1) break;
      // "IQ" must be a whole word so "unique"/"critique" don't trip it.
      if (needle === "iq") {
        const before = idx > 0 ? hay[idx - 1] : " ";
        const after = idx + 2 < hay.length ? hay[idx + 2] : " ";
        const isWord = (c: string) => /[a-z0-9]/.test(c);
        if (isWord(before) || isWord(after)) {
          from = idx + needle.length;
          continue;
        }
      }
      hits.push({ phrase, index: idx });
      from = idx + needle.length;
    }
  }
  return hits;
}
