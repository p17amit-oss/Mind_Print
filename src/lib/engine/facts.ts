// Loss-screen fact templates (BUILD PROMPT Section 5): losses never show a dead
// loss — always one specific fact from the run.
import { TRIALS, type TrialType } from "../trials";

function fmt(v: unknown): string {
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  return v == null ? "—" : String(v);
}

/** Fill one randomly-chosen loss-fact template from the run summary. */
export function pickLossFact(
  trialType: TrialType,
  summary: Record<string, unknown>,
  rand: () => number = Math.random
): string {
  const templates = TRIALS[trialType].lossFacts;
  const tpl = templates[Math.floor(rand() * templates.length)] ?? templates[0];
  return tpl.replace(/\{(\w+)\}/g, (_, key: string) => fmt(summary[key]));
}
