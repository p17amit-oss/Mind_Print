// POST /api/chest/open — open an unlocked chest and award later_n (Section 5).
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const id = req.body?.id as string;
  const chest = await queryOne<{ later_n: number }>(
    `UPDATE pending_chests SET opened = true
      WHERE id = $1 AND user_id = $2 AND opened = false AND unlocks_at <= now()
      RETURNING later_n`,
    [id, user.id]
  );
  if (!chest) return res.status(400).json({ error: "no openable chest" });
  await query(`UPDATE users SET star_balance = star_balance + $2 WHERE id = $1`, [user.id, chest.later_n]);
  const bal = await queryOne<{ star_balance: number }>(`SELECT star_balance FROM users WHERE id = $1`, [user.id]);
  res.status(200).json({ later_n: chest.later_n, stars: Math.max(0, Math.round(bal?.star_balance ?? 0)) });
}
