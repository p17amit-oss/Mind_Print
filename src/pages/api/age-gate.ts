// POST /api/age-gate — first-session age gate (BUILD PROMPT Section 3, step 1).
// Body: { age_band }. Sets is_adult; <18 => is_adult=false (gameplay only).
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { AGE_BANDS, isAdultBand, type AgeBand } from "@/lib/consent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const band = req.body?.age_band as AgeBand | undefined;
  if (!band || !AGE_BANDS.includes(band)) {
    return res.status(400).json({ error: "invalid age_band" });
  }
  const user = await getOrCreateUser(req, res);
  const isAdult = isAdultBand(band);
  await query(
    `UPDATE users SET age_band = $1, is_adult = $2 WHERE id = $3`,
    [band, isAdult, user.id]
  );
  res.status(200).json({ age_band: band, is_adult: isAdult });
}
