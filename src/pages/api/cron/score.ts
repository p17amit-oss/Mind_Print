// Cron: recompute scores for recently-active users (BUILD PROMPT Section 7).
// Protected by CRON_SECRET; wired in vercel.json.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/server/admin";
import { query } from "@/lib/db";
import { computeForm, recomputeScores } from "@/lib/server/scoring";
import { computeTelemetry } from "@/lib/server/telemetry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res, "cron")) return;
  const active = await query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM runs WHERE created_at > now() - interval '2 days'`
  );
  let scored = 0;
  for (const { user_id } of active.rows) {
    await recomputeScores(user_id);
    await computeForm(user_id);
    await computeTelemetry(user_id);
    scored++;
  }
  res.status(200).json({ scored });
}
