// Trial catalogue + per-trial config (BUILD PROMPT Section 6).
import type { DisplayDimension } from "./dimensions";

export const TRIAL_TYPES = [
  "neon_stream",
  "impostor",
  "heist",
  "alien_rules",
  "read_room",
  "fooled",
] as const;

export type TrialType = (typeof TRIAL_TYPES)[number];

/** Trials eligible to be flagged chaos_mode (Section 4 rotation rule). */
export const CHAOS_ELIGIBLE: TrialType[] = ["neon_stream", "impostor"];

export interface TrialMeta {
  type: TrialType;
  title: string;
  /** Primary dimension this trial resolves. */
  dimension: DisplayDimension;
  /** Extra dimension touched only in chaos mode, if any. */
  chaosDimension?: DisplayDimension;
  /** Core metric used for the trailing-baseline "success" comparison (Sec 5). */
  coreMetric: string;
  /** true if lower is better for the core metric (e.g. reaction time). */
  coreMetricLowerIsBetter: boolean;
  tagline: string;
  approxSeconds: number;
  /** 3–4 precomputed loss-screen fact templates; {x} filled from summary. */
  lossFacts: string[];
}

export const TRIALS: Record<TrialType, TrialMeta> = {
  neon_stream: {
    type: "neon_stream",
    title: "Neon Stream",
    dimension: "speed",
    chaosDimension: "flexibility",
    coreMetric: "median_hit_rt",
    coreMetricLowerIsBetter: true,
    tagline: "Tap real words. Let the fakes drift by.",
    approxSeconds: 45,
    lossFacts: [
      "Your fastest real hit landed at {best_rt}ms.",
      "You let {false_alarms} fakes slip a tap.",
      "Peak combo: ×{peak_combo}.",
      "d′ {d_prime} — you did separate signal from noise.",
    ],
  },
  impostor: {
    type: "impostor",
    title: "Impostor",
    dimension: "inhibition",
    coreMetric: "commission_error_rate",
    coreMetricLowerIsBetter: true,
    tagline: "Smash the real ones. Freeze on the fakes.",
    approxSeconds: 40,
    lossFacts: [
      "You held back on {near_misses} near-identical impostors.",
      "Go reaction time: {go_median_rt}ms.",
      "{hits} clean smashes.",
      "You caught yourself mid-swing {near_misses} times.",
    ],
  },
  heist: {
    type: "heist",
    title: "Heist",
    dimension: "working_memory",
    coreMetric: "max_span_cleared",
    coreMetricLowerIsBetter: false,
    tagline: "Hold the code. Track the mutations. Enter what's true now.",
    approxSeconds: 60,
    lossFacts: [
      "You cleared a span of {max_span_cleared}.",
      "You tracked {mutation_tracking_rate}% of mid-entry mutations.",
      "Accuracy at your top span: {accuracy_at_span}%.",
      "Three vaults down before the wall.",
    ],
  },
  alien_rules: {
    type: "alien_rules",
    title: "Alien Rules",
    dimension: "pattern_induction",
    coreMetric: "accuracy",
    coreMetricLowerIsBetter: false,
    tagline: "No instructions. Find the rule.",
    approxSeconds: 90,
    lossFacts: [
      "You solved {solved} of 4 matrices.",
      "Mean solve time: {mean_solve_ms}ms.",
      "You nailed the depth-{best_depth} rule.",
      "The hardest one had a rule three layers deep.",
    ],
  },
  read_room: {
    type: "read_room",
    title: "Read the Room",
    dimension: "social_read",
    coreMetric: "accuracy",
    coreMetricLowerIsBetter: false,
    tagline: "Not what you think — what everyone thinks.",
    approxSeconds: 45,
    lossFacts: [
      "You matched the crowd on {matched} of 3.",
      "The crowd was more split than it looked.",
      "You called the modal answer once.",
      "Closest miss: you were one option off the crowd.",
    ],
  },
  fooled: {
    type: "fooled",
    title: "Fooled",
    dimension: "detection",
    coreMetric: "detection_accuracy",
    coreMetricLowerIsBetter: false,
    tagline: "Real, or made? Call it.",
    approxSeconds: 60,
    lossFacts: [
      "You caught {caught} of {fakes} fakes.",
      "d′ {d_prime_detection} — a real sense for the seams.",
      "Median call: {median_call_rt}ms.",
      "The frontier-tier fake got past you. It gets past most.",
    ],
  },
};

export function trialMeta(t: TrialType): TrialMeta {
  return TRIALS[t];
}

/** Implied confidence per stake (Section 5). */
export const STAKE_CONFIDENCE: Record<1 | 2 | 3, number> = {
  1: 0.6,
  2: 0.75,
  3: 0.9,
};
