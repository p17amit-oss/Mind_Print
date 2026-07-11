// Star economy + wager resolution (BUILD PROMPT Section 5). Pure functions,
// used identically on client (optimistic) and server (authoritative).

export type Stake = 1 | 2 | 3;
export type WagerOutcome = "won" | "lost" | "baseline_building";

export interface WagerResolution {
  outcome: WagerOutcome;
  /** Star change; visible balance is floored at 0 by the caller. */
  starDelta: number;
  /** +0.5 credit for an accurate low bet (staked 1 and lost) — "You knew." */
  calibrationCredit: number;
  /** teal glint cue for the accurate-low-bet moment. */
  glint: boolean;
}

export interface ResolveInput {
  stake: Stake;
  /** Did the run beat the user's trailing baseline for this trial? */
  success: boolean;
  /** First 2 runs of any trial auto-succeed and are flagged baseline_building. */
  baselineBuilding: boolean;
}

export function resolveWager({ stake, success, baselineBuilding }: ResolveInput): WagerResolution {
  if (baselineBuilding) {
    // Auto-success while building baseline; award the stake, no penalty risk.
    return { outcome: "baseline_building", starDelta: stake, calibrationCredit: 0, glint: false };
  }
  if (success) {
    return { outcome: "won", starDelta: stake, calibrationCredit: 0, glint: false };
  }
  // Loss. An accurate low bet (staked 1) earns calibration credit — you knew.
  const accurateLowBet = stake === 1;
  return {
    outcome: "lost",
    starDelta: -stake,
    calibrationCredit: accurateLowBet ? 0.5 : 0,
    glint: accurateLowBet,
  };
}

/** Apply a star delta to a balance, flooring the visible balance at 0. */
export function applyStars(balance: number, delta: number): number {
  return Math.max(0, balance + delta);
}

/**
 * "Success" = beating YOUR trailing baseline (median of last 5 runs on the core
 * metric). `lowerIsBetter` handles reaction-time-style metrics.
 */
export function beatsBaseline(
  value: number,
  baselineMedian: number,
  lowerIsBetter: boolean
): boolean {
  return lowerIsBetter ? value < baselineMedian : value > baselineMedian;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
