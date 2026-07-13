// POST /api/dob/resolve — record a Double-or-Bank decision and settle stars.
// Body: { chose:'bank'|'ride', trialType?, output? }. (BUILD PROMPT Section 5)
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getTodaySession } from "@/lib/server/sessions";
import { beatsBaseline, median } from "@/lib/engine/wager";
import { trialMeta, type TrialType } from "@/lib/trials";
import type { TrialOutput } from "@/lib/engine/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const session = await getTodaySession(user.id);
  if (!session) return res.status(400).json({ error: "no session" });

  const chose = req.body?.chose as "bank" | "ride";
  // Recompute the at-stake amount server-side (don't trust the client).
  const wonRow = await queryOne<{ sum: string | null }>(
    `SELECT sum(wager)::text AS sum FROM runs WHERE session_id = $1 AND wager_outcome = 'won'`,
    [session.id]
  );
  const offeredN = Math.max(1, Number(wonRow?.sum ?? 0));

  let outcome: "won" | "lost" | null = null;
  let delta = 0;

  if (chose === "ride") {
    const trialType = req.body?.trialType as TrialType;
    const output = req.body?.output as TrialOutput | undefined;
    const meta = trialMeta(trialType);
    // Success = beat the trailing baseline for that trial.
    const trailing = await query<{ v: string }>(
      `SELECT (summary_metrics->>'core_metric_value') AS v FROM runs
        WHERE user_id = $1 AND trial_type = $2 AND summary_metrics ? 'core_metric_value'
        ORDER BY created_at DESC LIMIT 5`,
      [user.id, trialType]
    );
    const base = trailing.rows.map((r) => Number(r.v)).filter(Number.isFinite);
    const success = base.length
      ? beatsBaseline(Number(output?.coreMetricValue), median(base), meta.coreMetricLowerIsBetter)
      : true;
    outcome = success ? "won" : "lost";
    delta = success ? offeredN : -offeredN; // double or nothing on the at-stake stars
    await query(`UPDATE users SET star_balance = GREATEST(0, star_balance + $2) WHERE id = $1`, [
      user.id,
      delta,
    ]);
  }

  await query(
    `INSERT INTO preference_events (user_id, session_id, kind, payload)
     VALUES ($1,$2,'double_or_bank',$3)`,
    [
      user.id,
      session.id,
      JSON.stringify({
        offered_n: offeredN,
        chose,
        outcome,
        stake_context: { trialType: req.body?.trialType ?? null },
      }),
    ]
  );

  const bal = await queryOne<{ star_balance: number }>(
    `SELECT star_balance FROM users WHERE id = $1`,
    [user.id]
  );
  res.status(200).json({ chose, outcome, delta, offeredN, stars: Math.max(0, Math.round(bal?.star_balance ?? 0)) });
}
