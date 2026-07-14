// Compliance: banned strings + Form copy law (BUILD PROMPT Section 13).
import { describe, expect, it } from "vitest";
import {
  BANNED_FORM_STRINGS,
  BANNED_UI_STRINGS,
  COVENANT_LINE,
  PROFILE_FOOTER,
  scanForBanned,
} from "@/lib/compliance";
import { GAMEPLAY_TOS, RESEARCH_PARTICIPATION } from "@/lib/consent";
import { TRIALS } from "@/lib/trials";
import { DIMENSION_META } from "@/lib/dimensions";

describe("banned strings scanner", () => {
  it("flags each banned UI phrase", () => {
    for (const phrase of BANNED_UI_STRINGS) {
      expect(scanForBanned(`some copy with ${phrase} inside`).length).toBeGreaterThan(0);
    }
  });

  it("flags Form-banned phrases in form scope only", () => {
    for (const phrase of BANNED_FORM_STRINGS) {
      expect(scanForBanned(`chip says ${phrase} here`, "form").length).toBeGreaterThan(0);
    }
    expect(scanForBanned("a gentle decline in the road", "ui")).toHaveLength(0);
  });

  it("does not false-positive 'IQ' inside ordinary words", () => {
    expect(scanForBanned("a unique critique of oblique physiques")).toHaveLength(0);
  });

  it("allows the required footer despite containing 'clinical'", () => {
    expect(scanForBanned(PROFILE_FOOTER)).toHaveLength(0);
  });
});

describe("mandated copy", () => {
  it("gameplay ToS carries the covenant line verbatim", () => {
    expect(GAMEPLAY_TOS.body).toContain(COVENANT_LINE);
  });

  it("research consent decline is a first-class button", () => {
    expect(RESEARCH_PARTICIPATION.declineLabel).toBeTruthy();
  });

  it("player-facing copy constants are clean", () => {
    const surfaces: string[] = [
      ...GAMEPLAY_TOS.body,
      ...RESEARCH_PARTICIPATION.body,
      ...Object.values(TRIALS).flatMap((t) => [t.title, t.tagline, ...t.lossFacts]),
      ...Object.values(DIMENSION_META).flatMap((d) => [d.label, d.blurb, d.sharpenedBy]),
    ];
    for (const s of surfaces) {
      expect(scanForBanned(s, "form")).toHaveLength(0);
    }
  });
});
