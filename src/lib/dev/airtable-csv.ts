// Shared Airtable → item_cache CSV format (columns + escaping). Used by both the
// alien_rules and fooled export tools so the bulk-import format has one source of
// truth, matching src/lib/server/airtable-sync.ts.

export const AIRTABLE_CSV_COLUMNS = [
  "item_id",
  "trial_type",
  "content",
  "design_difficulty",
  "category",
  "generator_model",
  "provenance",
  "sponsor",
  "gauntlet_event_id",
  "status",
] as const;

export type AirtableCsvColumn = (typeof AIRTABLE_CSV_COLUMNS)[number];
export type AirtableCsvRow = Partial<Record<AirtableCsvColumn, unknown>>;

export function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize rows keyed by column name. Callers pass JSON strings for
 * `content`/`provenance` (objects would stringify to "[object Object]"). */
export function airtableCsv(rows: AirtableCsvRow[]): string {
  const lines = [AIRTABLE_CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(AIRTABLE_CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  }
  return lines.join("\n");
}
