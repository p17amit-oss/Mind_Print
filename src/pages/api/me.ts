// GET /api/me — resolve (or create) the anonymous user and return play state.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { getConsentState } from "@/lib/server/consent-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getOrCreateUser(req, res);
  const consent = await getConsentState(user.id, user.is_adult);
  res.status(200).json({
    user: {
      id: user.id,
      age_band: user.age_band,
      is_adult: user.is_adult,
      region: user.region,
    },
    consent,
    // What the client should show next in the first-session flow (Section 3).
    needsAgeGate: user.age_band === null,
    needsGameplayTos: consent.gameplay_tos !== "granted",
  });
}
