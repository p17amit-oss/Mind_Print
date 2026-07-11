// POST /api/consent — record a consent decision (BUILD PROMPT Section 3).
// Body: { type, decision }. Enforces adults-only research consent.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { recordConsent, type ConsentDecision } from "@/lib/server/consent-store";
import { CONSENT_COPY, type ConsentType } from "@/lib/consent";
import { recordServerEvent } from "@/lib/tracking";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const type = req.body?.type as ConsentType | undefined;
  const decision = req.body?.decision as ConsentDecision | undefined;
  if (!type || !(type in CONSENT_COPY)) {
    return res.status(400).json({ error: "invalid type" });
  }
  if (!decision || !["grant", "decline", "revoke"].includes(decision)) {
    return res.status(400).json({ error: "invalid decision" });
  }
  const user = await getOrCreateUser(req, res);
  try {
    const status = await recordConsent(user.id, type, decision, user.is_adult);
    if (type === "research_participation") {
      await recordServerEvent({
        name: "research_consent",
        userId: user.id,
        params: { result: decision === "grant" ? "granted" : decision === "decline" ? "declined" : "revoked" },
      });
    }
    res.status(200).json({ type, status });
  } catch (err) {
    // adults-only guard rejection lands here
    res.status(403).json({ error: (err as Error).message });
  }
}
