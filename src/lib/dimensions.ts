// Mind Print dimensions (BUILD PROMPT Section 2).

/** Dimensions displayed in the Print this phase — the 8 constellation vertices. */
export const DISPLAY_DIMENSIONS = [
  "speed",
  "inhibition",
  "working_memory",
  "pattern_induction",
  "social_read",
  "flexibility",
  "calibration",
  "detection",
] as const;

export type DisplayDimension = (typeof DISPLAY_DIMENSIONS)[number];

/** Computed-only this phase (no UI). */
export const COMPUTED_DIMENSIONS = ["composure"] as const;

/** Reserved for a month-2 content drop. */
export const RESERVED_DIMENSIONS = ["spatial"] as const;

export type Dimension = DisplayDimension | (typeof COMPUTED_DIMENSIONS)[number];

export const DIMENSION_META: Record<
  DisplayDimension,
  { label: string; blurb: string; sharpenedBy: string }
> = {
  speed: {
    label: "Speed",
    blurb: "How fast you separate signal from noise.",
    sharpenedBy: "Play Neon Stream.",
  },
  inhibition: {
    label: "Inhibition",
    blurb: "How well you hold back the wrong move.",
    sharpenedBy: "Play Impostor.",
  },
  working_memory: {
    label: "Memory",
    blurb: "How much you can hold and update at once.",
    sharpenedBy: "Play Heist.",
  },
  pattern_induction: {
    label: "Patterns",
    blurb: "How quickly you find the hidden rule.",
    sharpenedBy: "Play Alien Rules.",
  },
  social_read: {
    label: "Read",
    blurb: "How well you predict the crowd.",
    sharpenedBy: "Play Read the Room.",
  },
  flexibility: {
    label: "Flex",
    blurb: "How cleanly you switch when the rules flip.",
    sharpenedBy: "Hit a Chaos round.",
  },
  calibration: {
    label: "Calibration",
    blurb: "How well your confidence matches reality.",
    sharpenedBy: "Keep wagering honestly.",
  },
  detection: {
    label: "Detection",
    blurb: "How well you tell the real from the made.",
    sharpenedBy: "Play Fooled.",
  },
};

/**
 * Per-dimension SE0 constants (baseline standard error at n=0). resolution =
 * clamp(1 - SE/SE0, 0, 1); SE ∝ SE0/sqrt(n). Tuned so ~15 clean runs approaches
 * full resolution. See src/lib/scoring.ts.
 */
export const SE0: Record<DisplayDimension, number> = {
  speed: 1.0,
  inhibition: 1.0,
  working_memory: 1.1,
  pattern_induction: 1.1,
  social_read: 1.2,
  flexibility: 1.2,
  calibration: 1.0,
  detection: 1.1,
};
