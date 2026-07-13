// POST /api/score/recompute — recompute the current user's dimensions, Form, and
// computed telemetry (BUILD PROMPT Section 7/8/9). Called on session complete.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { computeForm, recomputeScores } from "@/lib/server/scoring";
import { computeTelemetry } from "@/lib/server/telemetry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  await recomputeScores(user.id);
  const form = await computeForm(user.id);
  await computeTelemetry(user.id);
  res.status(200).json({ ok: true, form });
}
