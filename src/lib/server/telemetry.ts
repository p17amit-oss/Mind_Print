// Computed telemetry (BUILD PROMPT Section 9). No UI this phase — written to the
// derived_metrics JSONB on dimension_scores under the 'composure' and
// 'preferences' pseudo-dimensions. These seed phase-2 features and are
// research-view eligible under the same consent rules.
import { query, queryOne } from "../db";
import type { TrialType } from "../trials";

async function writeDerived(userId: string, dimension: string, derived: Record<string, unknown>) {
  await query(
    `INSERT INTO dimension_scores (user_id, dimension, n_trials, derived_metrics, updated_at)
     VALUES ($1,$2,0,$3, now())
     ON CONFLICT (user_id, dimension) DO UPDATE SET
       derived_metrics = EXCLUDED.derived_metrics, updated_at = now()`,
    [userId, dimension, JSON.stringify(derived)]
  );
}

/** Composure: post-error dip, tilt after loss streaks, abandonment. */
async function composure(userId: string): Promise<Record<string, unknown>> {
  // Per-item correctness sequences (item-scored trials).
  const ev = await query<{ run_id: string; seq: number; correct: boolean }>(
    `SELECT e.run_id, e.seq, e.correct FROM events e
       JOIN runs r ON r.id = e.run_id
      WHERE r.user_id = $1 AND e.correct IS NOT NULL
      ORDER BY r.created_at, e.seq`,
    [userId]
  );
  const byRun = new Map<string, boolean[]>();
  for (const row of ev.rows) {
    const arr = byRun.get(row.run_id) ?? [];
    arr[row.seq] = row.correct;
    byRun.set(row.run_id, arr);
  }
  let total = 0, totalCorrect = 0, afterErr = 0, afterErrCorrect = 0;
  for (const arr of byRun.values()) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === undefined) continue;
      total++;
      if (arr[i]) totalCorrect++;
      if (i > 0 && arr[i - 1] === false) {
        // item follows an error → part of the recovery window (up to 3)
        for (let k = i; k < Math.min(arr.length, i + 3); k++) {
          if (arr[k] === undefined) continue;
          afterErr++;
          if (arr[k]) afterErrCorrect++;
        }
        break; // count the first error's window per run to avoid overlap
      }
    }
  }
  const baseAcc = total ? totalCorrect / total : null;
  const postErrAcc = afterErr ? afterErrCorrect / afterErr : null;
  const postErrorDip = baseAcc != null && postErrAcc != null ? baseAcc - postErrAcc : null;

  // Wager tilt after loss streaks.
  const runs = await query<{ wager: number; wager_outcome: string }>(
    `SELECT wager, wager_outcome FROM runs WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  let lossStreak = 0, tiltDeltas: number[] = [], lossDeltas: number[] = [];
  const seq = runs.rows;
  for (let i = 1; i < seq.length; i++) {
    const prev = seq[i - 1], cur = seq[i];
    if (prev.wager_outcome === "lost") lossDeltas.push(cur.wager - prev.wager);
    lossStreak = prev.wager_outcome === "lost" ? lossStreak + 1 : 0;
    if (lossStreak >= 2) tiltDeltas.push(cur.wager - prev.wager);
  }
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  // Session abandonment.
  const sess = await queryOne<{ total: string; done: string }>(
    `SELECT count(*)::text AS total, count(*) FILTER (WHERE completed)::text AS done
       FROM sessions WHERE user_id = $1`,
    [userId]
  );
  const totalS = Number(sess?.total ?? 0), doneS = Number(sess?.done ?? 0);

  return {
    post_error_dip: postErrorDip,
    tilt_index: mean(tiltDeltas),
    loss_response_stake_delta: mean(lossDeltas),
    abandon_rate: totalS ? (totalS - doneS) / totalS : null,
    n_items: total,
  };
}

/** Preference parameters: ride-rate, chest pattern, loss response, ambiguity. */
async function preferences(userId: string): Promise<Record<string, unknown>> {
  const pe = await query<{ kind: string; payload: Record<string, unknown> }>(
    `SELECT kind, payload FROM preference_events WHERE user_id = $1`,
    [userId]
  );
  const dob = pe.rows.filter((r) => r.kind === "double_or_bank");
  const chest = pe.rows.filter((r) => r.kind === "chest_choice");
  const rideRate = dob.length
    ? dob.filter((r) => r.payload?.chose === "ride").length / dob.length
    : null;
  const chestLaterRate = chest.length
    ? chest.filter((r) => r.payload?.chose === "later").length / chest.length
    : null;

  // Ambiguity: first-exposure stake vs familiar stake per trial type.
  const runs = await query<{ trial_type: TrialType; wager: number; created_at: string }>(
    `SELECT trial_type, wager, created_at FROM runs WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  const first = new Map<string, number>();
  const laterSum = new Map<string, { sum: number; n: number }>();
  for (const r of runs.rows) {
    if (!first.has(r.trial_type)) first.set(r.trial_type, r.wager);
    else {
      const l = laterSum.get(r.trial_type) ?? { sum: 0, n: 0 };
      l.sum += r.wager;
      l.n += 1;
      laterSum.set(r.trial_type, l);
    }
  }
  const ambDeltas: number[] = [];
  for (const [t, f] of first) {
    const l = laterSum.get(t);
    if (l && l.n) ambDeltas.push(f - l.sum / l.n);
  }
  const ambiguity = ambDeltas.length ? ambDeltas.reduce((a, b) => a + b, 0) / ambDeltas.length : null;

  return {
    double_or_bank_ride_rate: rideRate,
    chest_later_rate: chestLaterRate,
    ambiguity_first_vs_familiar: ambiguity,
    n_double_or_bank: dob.length,
    n_chest: chest.length,
  };
}

export async function computeTelemetry(userId: string): Promise<void> {
  await writeDerived(userId, "composure", await composure(userId));
  await writeDerived(userId, "preferences", await preferences(userId));
}
