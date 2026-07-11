// Hourly cron: pull Airtable item bank into item_cache (BUILD PROMPT Section 1).
// Wire in vercel.json crons. Protected by CRON_SECRET.
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/server/admin";
import { syncAirtable } from "@/lib/server/airtable-sync";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAuth(req, res, "cron")) return;
  try {
    const result = await syncAirtable();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
