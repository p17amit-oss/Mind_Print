// POST /api/seed-answers — protected panel ingestion (BUILD PROMPT Section 6.5).
// Seeds BOTH room_answers and jury_verdicts (the panel run happens outside this
// build). Accepts JSON: { room_answers: [{item_id,option,count}],
// jury_verdicts: [{item_id,verdict,count}] } or CSV via ?kind=room|jury.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/server/admin";
import { query } from "@/lib/db";

interface RoomRow { item_id: string; option: number; count: number }
interface JuryRow { item_id: string; verdict: number; count: number }

function parseCsv(body: string, kind: "room" | "jury"): (RoomRow | JuryRow)[] {
  const lines = body.trim().split(/\r?\n/);
  const rows: (RoomRow | JuryRow)[] = [];
  for (const line of lines) {
    const [item_id, n, count] = line.split(",").map((s) => s.trim());
    if (!item_id || item_id.toLowerCase() === "item_id") continue;
    if (kind === "room") rows.push({ item_id, option: Number(n), count: Number(count) });
    else rows.push({ item_id, verdict: Number(n), count: Number(count) });
  }
  return rows;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAuth(req, res, "admin")) return;

  let room: RoomRow[] = [];
  let jury: JuryRow[] = [];

  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("text/csv") || typeof req.body === "string") {
    const kind = (req.query.kind as string) === "jury" ? "jury" : "room";
    const parsed = parseCsv(String(req.body), kind);
    if (kind === "room") room = parsed as RoomRow[];
    else jury = parsed as JuryRow[];
  } else {
    room = (req.body?.room_answers as RoomRow[]) ?? [];
    jury = (req.body?.jury_verdicts as JuryRow[]) ?? [];
  }

  for (const r of room) {
    await query(
      `INSERT INTO room_answers (item_id, option, count) VALUES ($1,$2,$3)
       ON CONFLICT (item_id, option) DO UPDATE SET count = EXCLUDED.count`,
      [r.item_id, r.option, r.count]
    );
  }
  for (const j of jury) {
    await query(
      `INSERT INTO jury_verdicts (item_id, verdict, count) VALUES ($1,$2,$3)
       ON CONFLICT (item_id, verdict) DO UPDATE SET count = EXCLUDED.count`,
      [j.item_id, j.verdict, j.count]
    );
  }

  res.status(200).json({ room_answers: room.length, jury_verdicts: jury.length });
}
