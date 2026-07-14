// POST /api/session/complete — finalize the session, recompute, return Form.
// Body: { contextTags?: string[] (max 2) }.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { completeSession, getTodaySession } from "@/lib/server/sessions";
import { computeForm, recomputeScores } from "@/lib/server/scoring";
import { computeTelemetry } from "@/lib/server/telemetry";
import { getConsentState } from "@/lib/server/consent-store";
import { completedSessionCount } from "@/lib/server/sessions";
import { chestDue, selectChestOffer } from "@/lib/economy";
import { recordServerEvent } from "@/lib/tracking";

const VALID_TAGS = new Set(["slept_badly", "slept_great", "big_day", "coffee", "tired", "travel"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const session = await getTodaySession(user.id);
  if (!session) return res.status(400).json({ error: "no session today" });

  const tags = ((req.body?.contextTags as string[]) ?? [])
    .filter((t) => VALID_TAGS.has(t))
    .slice(0, 2);

  await completeSession(session.id, tags);

  // Capture resolutions before/after recompute → fog deltas for fog_clear_viewed.
  const before = await query<{ dimension: string; resolution: number | null }>(
    `SELECT dimension, resolution FROM dimension_scores WHERE user_id = $1`,
    [user.id]
  );
  const beforeMap = new Map(before.rows.map((r) => [r.dimension, r.resolution ?? 0]));

  await recomputeScores(user.id);
  const form = await computeForm(user.id);
  await computeTelemetry(user.id);

  const after = await query<{ dimension: string; resolution: number | null }>(
    `SELECT dimension, resolution FROM dimension_scores WHERE user_id = $1`,
    [user.id]
  );
  const fogDeltas = after.rows
    .map((r) => ({
      dimension: r.dimension,
      delta: Math.round(((r.resolution ?? 0) - (beforeMap.get(r.dimension) ?? 0)) * 100),
    }))
    .filter((d) => d.delta !== 0);

  await recordServerEvent({ name: "session_complete", userId: user.id, sessionId: session.id });
  if (tags.length) {
    await recordServerEvent({ name: "context_tags", userId: user.id, sessionId: session.id, params: { tags } });
  }

  const consent = await getConsentState(user.id, user.is_adult);

  // Chest offer every 7th completed session (Section 5).
  const count = await completedSessionCount(user.id);
  const chestOffer = chestDue(count) ? selectChestOffer(count) : null;

  res.status(200).json({
    sessionId: session.id,
    form,
    // Research prompt is shown once, AFTER the first completed session (adults).
    shouldPromptResearch: consent.shouldPromptResearch,
    chestOffer,
    fogDeltas,
  });
}
