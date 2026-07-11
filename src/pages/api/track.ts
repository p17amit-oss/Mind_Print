// POST /api/track — server-side analytics mirror (BUILD PROMPT Sections 1 & 16).
// Logs to Postgres and forwards to Pipedream. Rejects server-only event names
// arriving from the client (e.g. fooled_call is emitted server-side only).
import type { NextApiRequest, NextApiResponse } from "next";
import { getUser } from "@/lib/auth";
import {
  recordServerEvent,
  SERVER_ONLY_EVENTS,
  TRACK_EVENTS,
  type TrackEventName,
} from "@/lib/tracking";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const name = req.body?.name as TrackEventName | undefined;
  if (!name || !(name in TRACK_EVENTS)) {
    return res.status(400).json({ error: "unknown event" });
  }
  if (SERVER_ONLY_EVENTS.includes(name)) {
    return res.status(403).json({ error: "server-only event" });
  }
  const user = await getUser(req);
  await recordServerEvent({
    name,
    userId: user?.id ?? null,
    sessionId: (req.body?.sessionId as string) ?? null,
    params: (req.body?.params as Record<string, unknown>) ?? {},
  });
  res.status(200).json({ ok: true });
}
