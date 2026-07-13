// Scoring job + Form engine + computed telemetry (BUILD PROMPT Sections 7, 8, 9).
import { query, queryOne } from "../db";
import { DISPLAY_DIMENSIONS, SE0, type DisplayDimension } from "../dimensions";
import { STAKE_CONFIDENCE, trialMeta, type TrialType } from "../trials";
import { clamp } from "../engine/staircase";
import { todayISO } from "./sessions";

interface DimSource {
  trial: TrialType;
  metric: string;
  lowerIsBetter: boolean;
  chaosOnly?: boolean;
}

// Metric each display dimension reads from a trial's summary (calibration special).
const DIM_METRIC: Partial<Record<DisplayDimension, DimSource>> = {
  speed: { trial: "neon_stream", metric: "median_hit_rt", lowerIsBetter: true },
  inhibition: { trial: "impostor", metric: "commission_error_rate", lowerIsBetter: true },
  working_memory: { trial: "heist", metric: "max_span_cleared", lowerIsBetter: false },
  pattern_induction: { trial: "alien_rules", metric: "accuracy", lowerIsBetter: false },
  social_read: { trial: "read_room", metric: "accuracy", lowerIsBetter: false },
  detection: { trial: "fooled", metric: "detection_accuracy", lowerIsBetter: false },
  flexibility: { trial: "neon_stream", metric: "switch_cost_ms", lowerIsBetter: true, chaosOnly: true },
};

function resolutionFor(n: number): number {
  // SE ∝ SE0/√n → resolution = clamp(1 − SE/SE0, 0, 1) = clamp(1 − 1/√n, 0, 1).
  if (n <= 0) return 0;
  return clamp(1 - 1 / Math.sqrt(n), 0, 1);
}

async function userTrailing(
  userId: string,
  src: DimSource,
  limit: number
): Promise<number[]> {
  const res = await query<{ v: string }>(
    `SELECT (summary_metrics->>$3) AS v
       FROM runs
      WHERE user_id = $1 AND trial_type = $2
        ${src.chaosOnly ? "AND chaos_mode = true" : ""}
        AND summary_metrics ? $3
      ORDER BY created_at DESC LIMIT $4`,
    [userId, src.trial, src.metric, limit]
  );
  return res.rows.map((r) => Number(r.v)).filter(Number.isFinite);
}

async function pooledStats(src: DimSource): Promise<{ mean: number; sd: number; n: number }> {
  const row = await queryOne<{ mean: string | null; sd: string | null; n: string }>(
    `SELECT avg((summary_metrics->>$2)::numeric) AS mean,
            stddev_samp((summary_metrics->>$2)::numeric) AS sd,
            count(*)::text AS n
       FROM runs
      WHERE trial_type = $1 ${src.chaosOnly ? "AND chaos_mode = true" : ""}
        AND summary_metrics ? $2`,
    [src.trial, src.metric]
  );
  return {
    mean: Number(row?.mean ?? 0),
    sd: Number(row?.sd ?? 0),
    n: Number(row?.n ?? 0),
  };
}

async function upsertDimension(
  userId: string,
  dimension: string,
  score: number | null,
  se: number | null,
  n: number,
  resolution: number | null,
  derived?: Record<string, unknown>
) {
  await query(
    `INSERT INTO dimension_scores (user_id, dimension, score, se, n_trials, resolution, derived_metrics, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (user_id, dimension) DO UPDATE SET
       score = EXCLUDED.score, se = EXCLUDED.se, n_trials = EXCLUDED.n_trials,
       resolution = EXCLUDED.resolution,
       derived_metrics = COALESCE(EXCLUDED.derived_metrics, dimension_scores.derived_metrics),
       updated_at = now()`,
    [userId, dimension, score, se, n, resolution, derived ? JSON.stringify(derived) : null]
  );
}

/** Recompute all display dimensions for a user (Section 7). */
export async function recomputeScores(userId: string): Promise<void> {
  for (const dim of DISPLAY_DIMENSIONS) {
    if (dim === "calibration") continue;
    const src = DIM_METRIC[dim];
    if (!src) continue;

    const trailing = await userTrailing(userId, src, 15);
    const n = trailing.length;
    if (!n) {
      await upsertDimension(userId, dim, null, SE0[dim], 0, 0);
      continue;
    }
    const userMean = trailing.reduce((a, b) => a + b, 0) / n;
    const pooled = await pooledStats(src);
    let z = 0;
    if (pooled.sd > 0) z = (userMean - pooled.mean) / pooled.sd;
    if (src.lowerIsBetter) z = -z; // higher z always = better
    const se = SE0[dim] / Math.sqrt(n);
    await upsertDimension(userId, dim, Number(z.toFixed(3)), Number(se.toFixed(3)), n, resolutionFor(n));
  }

  await recomputeCalibration(userId);
}

/** Calibration = 1 − Brier over trailing 30 real wagers (Section 5). */
async function recomputeCalibration(userId: string): Promise<void> {
  const res = await query<{ wager: number; wager_outcome: string }>(
    `SELECT wager, wager_outcome FROM runs
      WHERE user_id = $1 AND wager_outcome IN ('won','lost')
      ORDER BY created_at DESC LIMIT 30`,
    [userId]
  );
  const rows = res.rows;
  const n = rows.length;
  if (!n) {
    await upsertDimension(userId, "calibration", null, SE0.calibration, 0, 0);
    return;
  }
  let brier = 0;
  for (const r of rows) {
    const conf = STAKE_CONFIDENCE[(r.wager as 1 | 2 | 3) ?? 2] ?? 0.75;
    const won = r.wager_outcome === "won" ? 1 : 0;
    brier += (conf - won) ** 2;
  }
  brier /= n;
  const score = 1 - brier;
  const se = SE0.calibration / Math.sqrt(n);
  // Surfaced only at n>=30 in the UI; resolution stored regardless.
  await upsertDimension(userId, "calibration", Number(score.toFixed(3)), Number(se.toFixed(3)), n, resolutionFor(n));
}

export interface FormChip {
  dimension: DisplayDimension;
  form_z: number | null;
  baseline_n: number;
  scaled: number | null; // signed integer ×10
  superlative?: string;
}

/**
 * Form engine (Section 8): per dimension touched today, form_z vs the user's own
 * trailing baseline over the last 15 runs (min 5 to display). Writes form_scores.
 */
export async function computeForm(userId: string, sessionDate = todayISO()): Promise<FormChip[]> {
  // Which trials ran today → which dimensions were touched.
  const todays = await query<{ trial_type: TrialType }>(
    `SELECT DISTINCT r.trial_type FROM runs r
       JOIN sessions s ON s.id = r.session_id
      WHERE r.user_id = $1 AND s.session_date = $2`,
    [userId, sessionDate]
  );
  const chips: FormChip[] = [];

  for (const { trial_type } of todays.rows) {
    const meta = trialMeta(trial_type);
    const dim = meta.dimension;
    const src = DIM_METRIC[dim];
    if (!src) continue;

    // today's value = latest run today
    const todayRow = await queryOne<{ v: string }>(
      `SELECT (r.summary_metrics->>$3) AS v FROM runs r
         JOIN sessions s ON s.id = r.session_id
        WHERE r.user_id = $1 AND r.trial_type = $2 AND s.session_date = $4
          AND r.summary_metrics ? $3
        ORDER BY r.created_at DESC LIMIT 1`,
      [userId, trial_type, src.metric, sessionDate]
    );
    if (!todayRow) continue;
    const todayVal = Number(todayRow.v);

    // baseline = previous up-to-15 runs (excluding today)
    const prior = await query<{ v: string }>(
      `SELECT (r.summary_metrics->>$3) AS v FROM runs r
         JOIN sessions s ON s.id = r.session_id
        WHERE r.user_id = $1 AND r.trial_type = $2 AND s.session_date < $4
          AND r.summary_metrics ? $3
        ORDER BY r.created_at DESC LIMIT 15`,
      [userId, trial_type, src.metric, sessionDate]
    );
    const base = prior.rows.map((r) => Number(r.v)).filter(Number.isFinite);
    const baseN = base.length;

    let formZ: number | null = null;
    let scaled: number | null = null;
    if (baseN >= 5) {
      const mean = base.reduce((a, b) => a + b, 0) / baseN;
      const sd = Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / baseN) || 1;
      let z = (todayVal - mean) / sd;
      if (src.lowerIsBetter) z = -z; // positive form = better than baseline
      formZ = Number(z.toFixed(3));
      scaled = Math.round(z * 10);
    }

    await query(
      `INSERT INTO form_scores (user_id, dimension, session_date, form_z, baseline_n)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, dimension, session_date)
       DO UPDATE SET form_z = EXCLUDED.form_z, baseline_n = EXCLUDED.baseline_n`,
      [userId, dim, sessionDate, formZ, baseN]
    );

    chips.push({ dimension: dim, form_z: formZ, baseline_n: baseN, scaled });
  }
  return chips;
}
