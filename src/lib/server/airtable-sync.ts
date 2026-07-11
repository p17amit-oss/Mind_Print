// Airtable item-bank CMS → Postgres item_cache sync (BUILD PROMPT Section 1).
// App reads item_cache only; Airtable is read-only upstream, pulled hourly.
import { query } from "../db";
import { validateFooledItem } from "./item-validation";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

const AIRTABLE_API = "https://api.airtable.com/v0";

async function fetchTable(baseId: string, table: string, apiKey: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(`${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) throw new Error(`Airtable ${table} ${resp.status}: ${await resp.text()}`);
    const data = (await resp.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

/** Coerce a possibly-string JSON field into an object. */
function asJson(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v; // leave as string; content may be plain text (fooled text items)
    }
  }
  return v;
}

export interface SyncResult {
  upserted: number;
  skipped: number;
  errors: string[];
}

export async function syncAirtable(): Promise<SyncResult> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tables = (process.env.AIRTABLE_TABLES ?? "items").split(",").map((t) => t.trim());
  if (!apiKey || !baseId) {
    throw new Error("AIRTABLE_API_KEY and AIRTABLE_BASE_ID required");
  }

  const result: SyncResult = { upserted: 0, skipped: 0, errors: [] };

  for (const table of tables) {
    const records = await fetchTable(baseId, table, apiKey);
    for (const rec of records) {
      const f = rec.fields;
      const itemId = (f.item_id as string) ?? rec.id;
      const trialType = (f.trial_type as string) ?? null;
      const provenance = asJson(f.provenance) as Record<string, unknown> | null;

      // Provenance gate for fooled human/AI items — reject invalid, don't cache.
      if (trialType === "fooled") {
        const errs = validateFooledItem({
          item_id: itemId,
          provenance: provenance as never,
          generator_model: (f.generator_model as string) ?? null,
        });
        if (errs.length) {
          result.skipped++;
          result.errors.push(...errs);
          continue;
        }
      }

      await query(
        `INSERT INTO item_cache
           (item_id, trial_type, content, design_difficulty, category,
            generator_model, provenance, sponsor, gauntlet_event_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (item_id) DO UPDATE SET
           trial_type = EXCLUDED.trial_type,
           content = EXCLUDED.content,
           design_difficulty = EXCLUDED.design_difficulty,
           category = EXCLUDED.category,
           generator_model = EXCLUDED.generator_model,
           provenance = EXCLUDED.provenance,
           sponsor = EXCLUDED.sponsor,
           gauntlet_event_id = EXCLUDED.gauntlet_event_id,
           status = EXCLUDED.status`,
        [
          itemId,
          trialType,
          JSON.stringify(asJson(f.content)),
          (f.design_difficulty as number) ?? null,
          (f.category as string) ?? null,
          (f.generator_model as string) ?? null,
          provenance ? JSON.stringify(provenance) : null,
          (f.sponsor as string) ?? null,
          (f.gauntlet_event_id as string) ?? null,
          (f.status as string) ?? "live",
        ]
      );
      result.upserted++;
    }
  }
  return result;
}
