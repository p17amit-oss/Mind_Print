// Trial rotation planner (BUILD PROMPT Section 4.2).
//   * 2 dimensions with highest current SE fill two slots
//   * third slot rotates
//   * fooled guaranteed >=2 of every 7 days (world-clock anchor); daily in a live event
//   * read_room at most once/day (plan holds distinct trials)
//   * from day 5, ~1 in 5 sessions marks one eligible trial (neon_stream|impostor) chaos
import { query, queryOne } from "../db";
import { SE0, type DisplayDimension } from "../dimensions";
import { CHAOS_ELIGIBLE, TRIAL_TYPES, type TrialType } from "../trials";
import { completedSessionCount, todayISO } from "./sessions";

const TRIAL_PRIMARY_DIM: Record<TrialType, DisplayDimension> = {
  neon_stream: "speed",
  impostor: "inhibition",
  heist: "working_memory",
  alien_rules: "pattern_induction",
  read_room: "social_read",
  fooled: "detection",
};

export interface Plan {
  trials: TrialType[];
  chaosIndex: number | null;
  inGauntlet: boolean;
  gauntletEventId: string | null;
}

async function seByTrial(userId: string): Promise<Record<TrialType, number>> {
  const rows = await query<{ dimension: string; se: number | null }>(
    `SELECT dimension, se FROM dimension_scores WHERE user_id = $1`,
    [userId]
  );
  const seByDim: Partial<Record<DisplayDimension, number>> = {};
  for (const r of rows.rows) seByDim[r.dimension as DisplayDimension] = r.se ?? undefined;
  const out = {} as Record<TrialType, number>;
  for (const t of TRIAL_TYPES) {
    const dim = TRIAL_PRIMARY_DIM[t];
    // Missing score → maximal SE (SE0) so new dimensions are prioritized.
    out[t] = seByDim[dim] ?? SE0[dim];
  }
  return out;
}

async function liveGauntlet(): Promise<{ id: string } | null> {
  return queryOne<{ id: string }>(
    `SELECT id FROM gauntlet_events
      WHERE status = 'live' AND now() BETWEEN starts_at AND ends_at
      ORDER BY starts_at DESC LIMIT 1`
  );
}

/** Distinct days in the last 7 that included a fooled run. */
async function fooledDaysLast7(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(DISTINCT s.session_date)::text AS n
       FROM runs r JOIN sessions s ON s.id = r.session_id
      WHERE r.user_id = $1 AND r.trial_type = 'fooled'
        AND s.session_date > (CURRENT_DATE - INTERVAL '7 days')`,
    [userId]
  );
  return Number(row?.n ?? 0);
}

export async function planTrials(userId: string): Promise<Plan> {
  const se = await seByTrial(userId);
  const gauntlet = await liveGauntlet();
  const inGauntlet = !!gauntlet;

  // Top-2 by SE.
  const bySE = [...TRIAL_TYPES].sort((a, b) => se[b] - se[a]);
  const topTwo = bySE.slice(0, 2);

  // Rotating third slot: rotate through the remaining trials by day.
  const dayIdx = Number(todayISO().replace(/-/g, "")) % 100000;
  const remaining = TRIAL_TYPES.filter((t) => !topTwo.includes(t));
  const third = remaining[dayIdx % remaining.length];

  let trials: TrialType[] = [topTwo[0], topTwo[1], third];

  // fooled guarantee: >=2 of every 7 days; daily during a live event.
  const fooledForced = inGauntlet || (await fooledDaysLast7(userId)) < 2;
  if (fooledForced && !trials.includes("fooled")) {
    // Replace the lowest-SE non-top slot (the third) with fooled.
    trials[2] = "fooled";
  }

  // Dedupe defensively (distinct trials → read_room can appear at most once).
  trials = Array.from(new Set(trials));
  while (trials.length < 3) {
    const filler = bySE.find((t) => !trials.includes(t));
    if (!filler) break;
    trials.push(filler);
  }
  trials = trials.slice(0, 3);

  // Chaos: from day 5, ~1 in 5 sessions, on an eligible trial in the plan.
  let chaosIndex: number | null = null;
  const dayNo = (await completedSessionCount(userId)) + 1;
  if (dayNo >= 5 && Math.random() < 0.2) {
    const idx = trials.findIndex((t) => CHAOS_ELIGIBLE.includes(t));
    if (idx >= 0) chaosIndex = idx;
  }

  return { trials, chaosIndex, inGauntlet, gauntletEventId: gauntlet?.id ?? null };
}
