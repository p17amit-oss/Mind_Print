// Run persistence + wager resolution (BUILD PROMPT Sections 5, 6, 16).
// Creates the run, logs events, resolves the wager against the user's trailing
// baseline, persists the staircase, updates the star balance, and emits the
// server-only fooled_call events. Returns the ResolutionData for the client.
import { query, queryOne } from "../db";
import { trialMeta, type TrialType } from "../trials";
import { applyStars, beatsBaseline, median, resolveWager, type Stake } from "../engine/wager";
import { pickLossFact } from "../engine/facts";
import { recordServerEvent } from "../tracking";
import type { ResolutionData, TrialEventLog } from "../engine/types";

export interface PersistRunInput {
  userId: string;
  sessionId: string;
  trialType: TrialType;
  chaos: boolean;
  stake: Stake;
  events: TrialEventLog[];
  summary: Record<string, number>;
  difficultyState: Record<string, unknown>;
  coreMetricValue: number;
  isBonus?: boolean;
}

async function trailingCoreMetrics(userId: string, trialType: TrialType, limit: number): Promise<number[]> {
  const res = await query<{ v: string }>(
    `SELECT (summary_metrics->>'core_metric_value') AS v
       FROM runs
      WHERE user_id = $1 AND trial_type = $2
        AND summary_metrics ? 'core_metric_value'
      ORDER BY created_at DESC LIMIT $3`,
    [userId, trialType, limit]
  );
  return res.rows.map((r) => Number(r.v)).filter((n) => Number.isFinite(n));
}

function formBeat(
  trialType: TrialType,
  value: number,
  trailing: number[],
  baselineBuilding: boolean
): string {
  const meta = trialMeta(trialType);
  if (baselineBuilding || trailing.length < 2) return "Your reading is still forming.";
  const mean = trailing.reduce((a, b) => a + b, 0) / trailing.length;
  const better = meta.coreMetricLowerIsBetter ? value < mean : value > mean;
  const much = Math.abs(value - mean) > 0.15 * (Math.abs(mean) || 1);
  if (better) return much ? "Sharp today. Fog thins." : "A touch sharper than your average.";
  return much ? "Foggy today — form, not fate." : "Right around your usual.";
}

export async function persistRun(input: PersistRunInput): Promise<ResolutionData> {
  const { userId, sessionId, trialType, chaos, stake, events, summary, difficultyState, coreMetricValue } =
    input;
  const meta = trialMeta(trialType);

  // Baseline: first 2 runs of any trial auto-succeed (baseline_building).
  const priorCountRow = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM runs WHERE user_id = $1 AND trial_type = $2`,
    [userId, trialType]
  );
  const priorCount = Number(priorCountRow?.n ?? 0);
  const baselineBuilding = priorCount < 2;

  const trailing = await trailingCoreMetrics(userId, trialType, 5);
  const baselineMedian = trailing.length ? median(trailing) : coreMetricValue;
  const success = baselineBuilding
    ? true
    : beatsBaseline(coreMetricValue, baselineMedian, meta.coreMetricLowerIsBetter);

  const w = resolveWager({ stake, success, baselineBuilding });

  // Persist the run.
  const summaryWithCore = { ...summary, core_metric_value: coreMetricValue };
  const run = await queryOne<{ id: string }>(
    `INSERT INTO runs (session_id, user_id, trial_type, chaos_mode, wager, wager_outcome,
                       difficulty_state, summary_metrics, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
     RETURNING id`,
    [
      sessionId,
      userId,
      trialType,
      chaos,
      stake,
      w.outcome,
      JSON.stringify(difficultyState ?? {}),
      JSON.stringify(summaryWithCore),
    ]
  );
  const runId = run!.id;

  // Log events.
  for (const e of events) {
    await query(
      `INSERT INTO events (run_id, seq, item_ref, stimulus, response, rt_ms, correct)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        runId,
        e.seq ?? null,
        e.item_ref ?? null,
        e.stimulus != null ? JSON.stringify(e.stimulus) : null,
        e.response != null ? JSON.stringify(e.response) : null,
        e.rt_ms ?? null,
        e.correct ?? null,
      ]
    );
  }

  // fooled_call — SERVER-SIDE ONLY, no PII (Section 16).
  if (trialType === "fooled") {
    for (const e of events) {
      const st = (e.stimulus ?? {}) as { modality?: string; tier?: number };
      await recordServerEvent({
        name: "fooled_call",
        userId: null,
        params: { tier: st.tier, modality: st.modality, correct: e.correct },
      });
    }
  }

  // Persist staircase across sessions.
  await query(
    `INSERT INTO staircase_state (user_id, trial_type, state)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, trial_type) DO UPDATE SET state = EXCLUDED.state`,
    [userId, trialType, JSON.stringify(difficultyState ?? {})]
  );

  // Update the star balance + calibration credit.
  const balRow = await queryOne<{ star_balance: number }>(
    `UPDATE users
        SET star_balance = GREATEST(0, star_balance + $2),
            calibration_credit = calibration_credit + $3
      WHERE id = $1
      RETURNING star_balance`,
    [userId, w.starDelta, w.calibrationCredit]
  );
  const stars = balRow ? applyStars(0, balRow.star_balance) : undefined;

  return {
    wager_outcome: w.outcome,
    starDelta: w.starDelta,
    calibrationCredit: w.calibrationCredit,
    glint: w.glint,
    lossFact: w.outcome === "lost" ? pickLossFact(trialType, summary) : undefined,
    formBeat: formBeat(trialType, coreMetricValue, trailing, baselineBuilding),
    coreMetricValue,
    stars,
  };
}
