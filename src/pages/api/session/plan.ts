// POST /api/session/plan — plan today's gauntlet and hydrate each trial slot.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { getOrCreateTodaySession } from "@/lib/server/sessions";
import { planTrials } from "@/lib/server/rotation";
import { getItemsForTrial, getLastStake, getStaircaseState } from "@/lib/server/items";
import { getConsentState } from "@/lib/server/consent-store";
import { recordServerEvent } from "@/lib/tracking";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const plan = await planTrials(user.id);
  const session = await getOrCreateTodaySession(user.id, plan.trials);
  const consent = await getConsentState(user.id, user.is_adult);

  const trials = await Promise.all(
    plan.trials.map(async (trialType, i) => ({
      trialType,
      chaos: plan.chaosIndex === i,
      difficulty: await getStaircaseState(user.id, trialType),
      items: await getItemsForTrial(trialType, {
        gauntletEventId: trialType === "fooled" ? plan.gauntletEventId : null,
        sponsoredEligible: consent.sponsoredEligible,
      }),
      lastStake: await getLastStake(user.id, trialType),
    }))
  );

  await recordServerEvent({ name: "session_start", userId: user.id, sessionId: session.id });
  if (plan.inGauntlet) {
    await recordServerEvent({
      name: "gauntlet_participation",
      userId: user.id,
      sessionId: session.id,
      params: { event_id: plan.gauntletEventId },
    });
  }

  res.status(200).json({
    sessionId: session.id,
    trials,
    inGauntlet: plan.inGauntlet,
    gauntletEventId: plan.gauntletEventId,
  });
}
