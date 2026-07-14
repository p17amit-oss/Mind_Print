// POST /api/admin/gauntlet — the whole gauntlet ingestion pipeline (BUILD PROMPT
// Section 6.6). Protected by ADMIN_TOKEN. Event weeks are ops, not code: this
// route creates an event, bulk-attaches a fresh fooled item batch, and flips
// status. Human items missing rights are rejected (provenance CI rule).
//
// Body (one of):
//   { action:'create', name, starts_at, ends_at, status? } -> { event_id }
//   { action:'attach', event_id, items:[{item_id, content, category, generator_model, provenance}] }
//   { action:'status', event_id, status:'draft'|'live'|'closed' }
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/server/admin";
import { query, queryOne } from "@/lib/db";
import { validateFooledItem } from "@/lib/server/item-validation";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAuth(req, res, "admin")) return;

  const action = req.body?.action as string;

  if (action === "create") {
    const { name, starts_at, ends_at, status } = req.body ?? {};
    const row = await queryOne<{ id: string }>(
      `INSERT INTO gauntlet_events (name, starts_at, ends_at, status)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [name ?? null, starts_at ?? null, ends_at ?? null, status ?? "draft"]
    );
    return res.status(200).json({ event_id: row!.id });
  }

  if (action === "attach") {
    const eventId = req.body?.event_id as string;
    const items = (req.body?.items as Record<string, unknown>[]) ?? [];
    if (!eventId) return res.status(400).json({ error: "event_id required" });

    const errors: string[] = [];
    let attached = 0;
    for (const it of items) {
      const provenance = it.provenance as Record<string, unknown> | null;
      const errs = validateFooledItem({
        item_id: String(it.item_id),
        provenance: provenance as never,
        generator_model: (it.generator_model as string) ?? null,
      });
      if (errs.length) {
        errors.push(...errs);
        continue;
      }
      await query(
        `INSERT INTO item_cache
           (item_id, trial_type, content, category, generator_model, provenance, gauntlet_event_id, status)
         VALUES ($1,'fooled',$2,$3,$4,$5,$6,'live')
         ON CONFLICT (item_id) DO UPDATE SET
           content = EXCLUDED.content, category = EXCLUDED.category,
           generator_model = EXCLUDED.generator_model, provenance = EXCLUDED.provenance,
           gauntlet_event_id = EXCLUDED.gauntlet_event_id, status = 'live'`,
        [
          String(it.item_id),
          it.content != null ? JSON.stringify(it.content) : null,
          (it.category as string) ?? "text",
          (it.generator_model as string) ?? null,
          provenance ? JSON.stringify(provenance) : null,
          eventId,
        ]
      );
      attached++;
    }
    return res.status(200).json({ attached, rejected: errors.length, errors });
  }

  if (action === "status") {
    const eventId = req.body?.event_id as string;
    const status = req.body?.status as string;
    if (!eventId || !["draft", "live", "closed"].includes(status)) {
      return res.status(400).json({ error: "bad event_id/status" });
    }
    await query(`UPDATE gauntlet_events SET status = $2 WHERE id = $1`, [eventId, status]);
    return res.status(200).json({ event_id: eventId, status });
  }

  return res.status(400).json({ error: "unknown action" });
}
