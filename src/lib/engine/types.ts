// Trial engine contracts (BUILD PROMPT Section 4.3, build step 3).
// Every trial is a React component implementing TrialComponentProps; the
// TrialShell drives wager → trial → resolution and reports the run upward.
import type { TrialType } from "../trials";
import type { Stake, WagerOutcome } from "./wager";

/** One logged response within a run (maps to the `events` table). */
export interface TrialEventLog {
  seq: number;
  item_ref?: string | null;
  stimulus?: unknown;
  response?: unknown;
  rt_ms?: number | null;
  correct?: boolean | null;
}

/** What a trial component produces when it finishes. */
export interface TrialOutput {
  events: TrialEventLog[];
  /** summary_metrics JSONB (per-trial shape, Section 6). */
  summary: Record<string, number>;
  /** difficulty_state JSONB — the staircase snapshot for this run. */
  difficultyState: Record<string, unknown>;
  /** Value of the trial's core metric this run (for baseline comparison). */
  coreMetricValue: number;
}

export interface TrialComponentProps {
  chaos: boolean;
  /** Staircase params / difficulty for this run. */
  difficulty: Record<string, unknown>;
  /** Item-bank slice for item-based trials (alien_rules, read_room, fooled). */
  items?: unknown[];
  onComplete: (out: TrialOutput) => void;
}

/** Resolution payload returned by the run submitter (client stub or /api/run). */
export interface ResolutionData {
  wager_outcome: WagerOutcome;
  starDelta: number;
  calibrationCredit: number;
  glint: boolean;
  /** one precomputed loss fact (Section 5 — losses never show a dead loss). */
  lossFact?: string;
  /** one fog/form beat line for the resolution screen. */
  formBeat?: string;
  coreMetricValue: number;
  /** running visible star balance after this run. */
  stars?: number;
}

/** Submit a completed run + stake, get back the resolution. */
export type RunSubmitter = (args: {
  trialType: TrialType;
  chaos: boolean;
  stake: Stake;
  output: TrialOutput;
}) => Promise<ResolutionData>;
