// POST /api/run — persist a completed trial run and resolve the wager.
// Body: { sessionId?, trialType, chaos, stake, output }.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { getOrCreateTodaySession } from "@/lib/server/sessions";
import { persistRun } from "@/lib/server/runs";
import { TRIAL_TYPES, type TrialType } from "@/lib/trials";
import type { Stake } from "@/lib/engine/wager";
import type { TrialOutput } from "@/lib/engine/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const trialType = req.body?.trialType as TrialType;
  const stake = Number(req.body?.stake) as Stake;
  const chaos = Boolean(req.body?.chaos);
  const output = req.body?.output as TrialOutput | undefined;
  const isBonus = Boolean(req.body?.isBonus);

  if (!TRIAL_TYPES.includes(trialType)) return res.status(400).json({ error: "bad trialType" });
  if (![1, 2, 3].includes(stake)) return res.status(400).json({ error: "bad stake" });
  if (!output || !Array.isArray(output.events) || typeof output.summary !== "object") {
    return res.status(400).json({ error: "bad output" });
  }

  const user = await getOrCreateUser(req, res);
  const providedSession = req.body?.sessionId as string | undefined;
  const session = providedSession
    ? { id: providedSession }
    : await getOrCreateTodaySession(user.id);

  const resolution = await persistRun({
    userId: user.id,
    sessionId: session.id,
    trialType,
    chaos,
    stake,
    events: output.events,
    summary: output.summary,
    difficultyState: output.difficultyState ?? {},
    coreMetricValue: Number(output.coreMetricValue),
    isBonus,
  });

  res.status(200).json({ sessionId: session.id, resolution });
}
