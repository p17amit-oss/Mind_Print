// GET /api/chest/pending — is there an unlocked chest ready to open on home?
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getOrCreateUser(req, res);
  const chest = await queryOne<{ id: string; later_n: number }>(
    `SELECT id, later_n FROM pending_chests
      WHERE user_id = $1 AND opened = false AND unlocks_at <= now()
      ORDER BY unlocks_at ASC LIMIT 1`,
    [user.id]
  );
  res.status(200).json({ ready: chest ?? null });
}
