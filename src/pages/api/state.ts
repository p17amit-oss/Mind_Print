// GET /api/state — home constellation state (BUILD PROMPT Sections 4, 10).
import type { NextApiRequest, NextApiResponse } from "next";
import { getOrCreateUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { DISPLAY_DIMENSIONS, DIMENSION_META, SE0, type DisplayDimension } from "@/lib/dimensions";
import { getTodaySession, todayISO } from "@/lib/server/sessions";

export interface DimensionState {
  dimension: DisplayDimension;
  label: string;
  resolution: number;
  score: number | null;
  se: number | null;
  n_trials: number;
  form_scaled: number | null;
  baseline_n: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getOrCreateUser(req, res);

  const dimRows = await query<{ dimension: string; resolution: number | null; score: number | null; se: number | null; n_trials: number }>(
    `SELECT dimension, resolution, score, se, n_trials FROM dimension_scores WHERE user_id = $1`,
    [user.id]
  );
  const dimMap = new Map(dimRows.rows.map((r) => [r.dimension, r]));

  // Today's Form chips; else yesterday's (latest available), per Section 4.1.
  const formRows = await query<{ dimension: string; form_z: number | null; baseline_n: number }>(
    `SELECT dimension, form_z, baseline_n FROM form_scores
      WHERE user_id = $1
        AND session_date = (
          SELECT max(session_date) FROM form_scores WHERE user_id = $1 AND session_date <= $2
        )`,
    [user.id, todayISO()]
  );
  const formMap = new Map(formRows.rows.map((r) => [r.dimension, r]));

  const dimensions: DimensionState[] = DISPLAY_DIMENSIONS.map((d) => {
    const row = dimMap.get(d);
    const form = formMap.get(d);
    return {
      dimension: d,
      label: DIMENSION_META[d].label,
      resolution: row?.resolution ?? 0,
      score: row?.score ?? null,
      se: row?.se ?? SE0[d],
      n_trials: row?.n_trials ?? 0,
      form_scaled: form?.form_z != null ? Math.round(form.form_z * 10) : null,
      baseline_n: form?.baseline_n ?? 0,
    };
  });

  const overallResolution =
    dimensions.reduce((a, d) => a + d.resolution, 0) / dimensions.length;

  // Tomorrow tease = highest-SE (least resolved) display dimension, name only.
  const tease = [...dimensions].sort((a, b) => (b.se ?? 0) - (a.se ?? 0))[0];

  const session = await getTodaySession(user.id);
  const starRow = await queryOne<{ star_balance: number }>(
    `SELECT star_balance FROM users WHERE id = $1`,
    [user.id]
  );

  // Live gauntlet + world catch-rate for the banner (aggregate, n>=50 gated).
  const gauntlet = await queryOne<{ id: string; name: string | null }>(
    `SELECT id, name FROM gauntlet_events
      WHERE status = 'live' AND now() BETWEEN starts_at AND ends_at
      ORDER BY starts_at DESC LIMIT 1`
  );
  let gauntletBlock: { name: string | null; worldCatchRate: number | null } | null = null;
  if (gauntlet) {
    const cr = await queryOne<{ n: string; rate: string | null }>(
      `SELECT count(*)::text AS n, avg((e.correct)::int)::text AS rate
         FROM events e
         JOIN runs r ON r.id = e.run_id AND r.trial_type = 'fooled'
         JOIN item_cache ic ON ic.item_id = e.item_ref
        WHERE ic.gauntlet_event_id = $1 AND e.correct IS NOT NULL`,
      [gauntlet.id]
    );
    const n = Number(cr?.n ?? 0);
    gauntletBlock = {
      name: gauntlet.name,
      worldCatchRate: n >= 50 && cr?.rate != null ? Math.round(Number(cr.rate) * 100) : null,
    };
  }

  res.status(200).json({
    dimensions,
    overallResolution,
    hasCompletedToday: session?.completed ?? false,
    hasSessionToday: !!session,
    tomorrowTease: { dimension: tease.dimension, label: tease.label },
    stars: Math.max(0, Math.round(starRow?.star_balance ?? 0)),
    gauntlet: gauntletBlock,
  });
}
