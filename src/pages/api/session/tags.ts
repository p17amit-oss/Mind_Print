// POST /api/session/tags — save context tags on today's session (Section 4.5).
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { getTodaySession } from "@/lib/server/sessions";
import { query } from "@/lib/db";
import { recordServerEvent } from "@/lib/tracking";

const VALID = new Set(["slept_badly", "slept_great", "big_day", "coffee", "tired", "travel"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const session = await getTodaySession(user.id);
  if (!session) return res.status(400).json({ error: "no session" });
  const tags = ((req.body?.tags as string[]) ?? []).filter((t) => VALID.has(t)).slice(0, 2);
  await query(`UPDATE sessions SET context_tags = $2 WHERE id = $1`, [
    session.id,
    tags.length ? tags : null,
  ]);
  if (tags.length) {
    await recordServerEvent({ name: "context_tags", userId: user.id, sessionId: session.id, params: { tags } });
  }
  res.status(200).json({ tags });
}
