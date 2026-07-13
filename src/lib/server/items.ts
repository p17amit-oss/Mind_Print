// Serve item-bank slices from item_cache to trials (BUILD PROMPT Section 6).
// When the cache has too few items the API returns [] and the client falls back
// to its local bank, guaranteeing a full, playable run in every environment.
import { query, queryOne } from "../db";
import type { TrialType } from "../trials";

export async function getStaircaseState(
  userId: string,
  trialType: TrialType
): Promise<Record<string, unknown>> {
  const row = await queryOne<{ state: Record<string, unknown> }>(
    `SELECT state FROM staircase_state WHERE user_id = $1 AND trial_type = $2`,
    [userId, trialType]
  );
  return row?.state ?? {};
}

export async function getLastStake(userId: string, trialType: TrialType): Promise<number> {
  const row = await queryOne<{ wager: number }>(
    `SELECT wager FROM runs WHERE user_id = $1 AND trial_type = $2
      ORDER BY created_at DESC LIMIT 1`,
    [userId, trialType]
  );
  return row?.wager ?? 2;
}

interface CacheRow {
  item_id: string;
  content: Record<string, unknown> | null;
  category: string | null;
  generator_model: string | null;
  provenance: Record<string, unknown> | null;
  sponsor: string | null;
}

/**
 * Items for a trial. `gauntletEventId` scopes fooled to a live event's batch.
 * Returns [] for procedural trials or when the cache is too thin to fill a run.
 */
export async function getItemsForTrial(
  trialType: TrialType,
  opts: { gauntletEventId?: string | null; sponsoredEligible?: boolean } = {}
): Promise<unknown[]> {
  if (trialType === "neon_stream" || trialType === "impostor" || trialType === "heist") {
    return []; // procedural
  }

  if (trialType === "fooled") {
    const where = opts.gauntletEventId
      ? "gauntlet_event_id = $1"
      : "gauntlet_event_id IS NULL";
    const params = opts.gauntletEventId ? [opts.gauntletEventId] : [];
    const rows = await query<CacheRow>(
      `SELECT item_id, content, category, generator_model, provenance, sponsor
         FROM item_cache
        WHERE trial_type = 'fooled' AND status = 'live' AND ${where}
        ORDER BY random() LIMIT 8`,
      params
    );
    if (rows.rows.length < 8) return [];
    return rows.rows.map((r) => {
      const c = (r.content ?? {}) as Record<string, unknown>;
      const isFake = (r.provenance as { source_type?: string } | null)?.source_type === "ai";
      return {
        item_id: r.item_id,
        modality: r.category ?? "text",
        isFake,
        tier: Number(c.fake_quality_tier ?? 2),
        text: c.text as string | undefined,
        imageSeed: c.image_seed as number | undefined,
        provenance: r.provenance ?? {},
        generator_model: r.generator_model,
      };
    });
  }

  if (trialType === "alien_rules") {
    const rows = await query<CacheRow>(
      `SELECT item_id, content FROM item_cache
        WHERE trial_type = 'alien_rules' AND status = 'live'
        ORDER BY random() LIMIT 4`
    );
    if (rows.rows.length < 4) return [];
    return rows.rows.map((r) => r.content);
  }

  if (trialType === "read_room") {
    // Standard items (with distributions) + up to 1 jury item, respecting the
    // sponsored-eligibility gate. Returns [] when too thin → local bank fallback.
    const standard = await query<CacheRow>(
      `SELECT item_id, content, category, sponsor FROM item_cache
        WHERE trial_type = 'read_room' AND status = 'live'
          AND category IN ('aesthetic','estimate','would_rather')
          ${opts.sponsoredEligible ? "" : "AND sponsor IS NULL"}
        ORDER BY random() LIMIT 2`
    );
    if (standard.rows.length < 2) return [];
    const out: unknown[] = [];
    for (const r of standard.rows) {
      const dist = await query<{ option: number; count: number }>(
        `SELECT option, count FROM room_answers WHERE item_id = $1 ORDER BY option`,
        [r.item_id]
      );
      const c = (r.content ?? {}) as Record<string, unknown>;
      out.push({
        item_id: r.item_id,
        category: r.category,
        prompt: c.prompt,
        options: c.options,
        distribution: dist.rows.map((d) => d.count),
        sponsor: r.sponsor,
      });
    }
    return out;
  }

  return [];
}
