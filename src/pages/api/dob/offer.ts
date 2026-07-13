// POST /api/dob/offer — is Double-or-Bank available, and for how many stars?
// (BUILD PROMPT Section 5). Weekly cap enforced server-side.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getTodaySession } from "@/lib/server/sessions";
import { getStaircaseState } from "@/lib/server/items";
import { DOB_DIFFICULTY_BUMP, DOB_WEEKLY_CAP } from "@/lib/economy";
import type { TrialType } from "@/lib/trials";
import type { StaircaseState } from "@/lib/engine/staircase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const session = await getTodaySession(user.id);
  if (!session) return res.status(200).json({ eligible: false });

  // Weekly cap.
  const capRow = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM preference_events
      WHERE user_id = $1 AND kind = 'double_or_bank' AND ts > now() - interval '7 days'`,
    [user.id]
  );
  if (Number(capRow?.n ?? 0) >= DOB_WEEKLY_CAP) return res.status(200).json({ eligible: false });

  // Stars won this session (what's at stake to ride).
  const wonRow = await queryOne<{ sum: string | null }>(
    `SELECT sum(wager)::text AS sum FROM runs
      WHERE session_id = $1 AND wager_outcome = 'won'`,
    [session.id]
  );
  const offeredN = Math.max(1, Number(wonRow?.sum ?? 0));

  // Bonus round = a trial played today, difficulty bumped +2 steps.
  const trialRow = await queryOne<{ trial_type: TrialType }>(
    `SELECT trial_type FROM runs WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [session.id]
  );
  const trialType = (trialRow?.trial_type ?? "neon_stream") as TrialType;
  const base = (await getStaircaseState(user.id, trialType)) as { staircase?: StaircaseState };
  const bumped: StaircaseState = {
    level: (base.staircase?.level ?? 3) + DOB_DIFFICULTY_BUMP,
    downRun: 0,
    upRun: 0,
  };

  res.status(200).json({
    eligible: true,
    offeredN,
    trialType,
    difficulty: { staircase: bumped },
  });
}
