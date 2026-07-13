// GET /api/card/[sessionId] — spoiler-free daily card data (BUILD PROMPT Section 11).
// Node runtime (Postgres pool). The edge OG route consumes this JSON.
import type { NextApiRequest, NextApiResponse } from "next";
import { query, queryOne } from "@/lib/db";
import { trialMeta, type TrialType } from "@/lib/trials";
import { hashCard, outcomeBar, type CardData, type CardTrial } from "@/lib/card";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) return res.status(400).json({ error: "no session" });

  const session = await queryOne<{ user_id: string; session_date: string }>(
    `SELECT user_id, session_date::text FROM sessions WHERE id = $1`,
    [sessionId]
  );
  if (!session) return res.status(404).json({ error: "not found" });

  const runs = await query<{ trial_type: TrialType; wager: number; wager_outcome: string | null; summary_metrics: Record<string, number> }>(
    `SELECT trial_type, wager, wager_outcome, summary_metrics FROM runs
      WHERE session_id = $1 ORDER BY created_at`,
    [sessionId]
  );

  const trials: CardTrial[] = runs.rows.slice(0, 3).map((r) => ({
    trial: r.trial_type,
    title: trialMeta(r.trial_type).title,
    bar: outcomeBar(r.wager_outcome, r.wager),
    stake: r.wager,
    outcome: (r.wager_outcome as CardTrial["outcome"]) ?? null,
  }));

  // Overall resolution.
  const reso = await queryOne<{ avg: string | null }>(
    `SELECT avg(resolution)::text AS avg FROM dimension_scores
      WHERE user_id = $1 AND dimension IN
        ('speed','inhibition','working_memory','pattern_induction','social_read','flexibility','calibration','detection')`,
    [session.user_id]
  );
  const resolutionPct = Math.round(Number(reso?.avg ?? 0) * 100);

  // Form line when notable (|form| >= 5).
  const form = await queryOne<{ dimension: string; form_z: number }>(
    `SELECT dimension, form_z FROM form_scores
      WHERE user_id = $1 AND session_date = $2 AND abs(form_z) >= 0.5
      ORDER BY abs(form_z) DESC LIMIT 1`,
    [session.user_id, session.session_date]
  );
  const formLine = form ? `Form ${form.form_z >= 0 ? "+" : ""}${Math.round(form.form_z * 10)} today` : null;

  // Fooled line during a live gauntlet event.
  let fooledLine: string | null = null;
  const gauntlet = await queryOne<{ id: string }>(
    `SELECT id FROM gauntlet_events WHERE status='live' AND now() BETWEEN starts_at AND ends_at LIMIT 1`
  );
  if (gauntlet) {
    const fooledRun = runs.rows.find((r) => r.trial_type === "fooled");
    if (fooledRun) {
      const caught = fooledRun.summary_metrics?.caught ?? 0;
      const fakes = fooledRun.summary_metrics?.fakes ?? 8;
      const world = await queryOne<{ rate: string | null; n: string }>(
        `SELECT avg((e.correct)::int)::text AS rate, count(*)::text AS n FROM events e
           JOIN runs r ON r.id = e.run_id AND r.trial_type='fooled'
           JOIN item_cache ic ON ic.item_id = e.item_ref
          WHERE ic.gauntlet_event_id = $1 AND e.correct IS NOT NULL`,
        [gauntlet.id]
      );
      const worldPct = Number(world?.n ?? 0) >= 50 && world?.rate != null ? Math.round(Number(world.rate) * 100) : null;
      fooledLine = worldPct != null
        ? `Caught ${caught}/${fakes} fakes — world avg ${worldPct}%`
        : `Caught ${caught}/${fakes} fakes`;
    }
  }

  const partial = { sessionId, date: session.session_date, resolutionPct, trials, formLine, fooledLine };
  const card: CardData = { ...partial, contentHash: hashCard(partial) };

  res.setHeader("Cache-Control", "public, max-age=600");
  res.status(200).json(card);
}
