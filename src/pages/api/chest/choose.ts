// POST /api/chest/choose — record the Chest choice (BUILD PROMPT Section 5).
// Body: { chose:'now'|'later' }. 'now' awards now_n immediately; 'later' schedules
// a bigger chest that unlocks after delay_days. The (now,later,delay) grid IS the
// delay-discounting instrument — no UI explains it.
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { completedSessionCount } from "@/lib/server/sessions";
import { chestDue, selectChestOffer } from "@/lib/economy";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await getOrCreateUser(req, res);
  const count = await completedSessionCount(user.id);
  if (!chestDue(count)) return res.status(400).json({ error: "no chest due" });

  const offer = selectChestOffer(count);
  const chose = req.body?.chose === "later" ? "later" : "now";

  if (chose === "now") {
    await query(`UPDATE users SET star_balance = star_balance + $2 WHERE id = $1`, [user.id, offer.now_n]);
  } else {
    await query(
      `INSERT INTO pending_chests (user_id, now_n, later_n, unlocks_at)
       VALUES ($1,$2,$3, now() + ($4 || ' days')::interval)`,
      [user.id, offer.now_n, offer.later_n, String(offer.delay_days)]
    );
  }

  await query(
    `INSERT INTO preference_events (user_id, kind, payload)
     VALUES ($1,'chest_choice',$2)`,
    [user.id, JSON.stringify({ now_n: offer.now_n, later_n: offer.later_n, delay_days: offer.delay_days, chose })]
  );

  const bal = await queryOne<{ star_balance: number }>(`SELECT star_balance FROM users WHERE id = $1`, [user.id]);
  res.status(200).json({ chose, offer, stars: Math.max(0, Math.round(bal?.star_balance ?? 0)) });
}
