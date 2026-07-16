// Fooled batch ingestion logic (BUILD PROMPT Section 6.6). Pure — no fs/network,
// so it's unit-testable; the CLI (scripts/ingest-fooled-batch.ts) supplies file
// bytes / hashes. Provenance rules reuse the canonical validator so the tool can
// never drift from the CI check.
import {
  VALID_RIGHTS,
  validateFooledItem,
  type Provenance,
} from "../server/item-validation";
import { airtableCsv } from "./airtable-csv";

export type Modality = "image" | "text";
export type SourceType = "human" | "ai";

export interface ManifestRow {
  item_id?: string;
  modality?: string;
  source_type?: string;
  path?: string;
  url?: string;
  text?: string;
  fake_quality_tier?: number | string;
  rights?: string;
  source_ref?: string;
  generator_model?: string;
  created?: string;
}

/** An item_cache-shaped fooled item, staged locally (not yet live in Airtable). */
export interface StagedFooledItem {
  item_id: string;
  trial_type: "fooled";
  category: Modality; // modality
  content: { fake_quality_tier: number; text?: string; image_src?: string };
  generator_model: string | null;
  provenance: Provenance;
  content_hash: string;
  design_difficulty: number; // = tier (author-eyeballed difficulty)
  status: "staged" | "live";
  source: { path?: string; url?: string };
}

export interface RowError {
  row: number; // 1-based manifest row
  item_id?: string;
  field: string;
  message: string;
  /** 'legal' = human-rights failure — the headline, must never be buried. */
  severity: "legal" | "error";
}

export interface RowDraft {
  row: number;
  modality: Modality;
  source_type: SourceType;
  tier: number;
  text?: string;
  path?: string;
  url?: string;
  provenance: Provenance;
  generator_model: string | null;
  item_id?: string;
}

export interface ValidatedRow {
  errors: RowError[];
  draft?: RowDraft;
}

const TIERS = new Set([1, 2, 3, 4]);

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Validate one manifest row. Returns structured errors + a draft when clean. */
export function validateRow(raw: ManifestRow, index0: number): ValidatedRow {
  const row = index0 + 1;
  const errors: RowError[] = [];
  const id = raw.item_id;

  const modality = raw.modality as Modality;
  if (modality !== "image" && modality !== "text") {
    errors.push({ row, item_id: id, field: "modality", message: `modality must be 'image' or 'text' (got ${JSON.stringify(raw.modality)})`, severity: "error" });
  }
  const source_type = raw.source_type as SourceType;
  if (source_type !== "human" && source_type !== "ai") {
    errors.push({ row, item_id: id, field: "source_type", message: `source_type must be 'human' or 'ai' (got ${JSON.stringify(raw.source_type)})`, severity: "error" });
  }
  const tier = Number(raw.fake_quality_tier);
  if (!TIERS.has(tier)) {
    errors.push({ row, item_id: id, field: "fake_quality_tier", message: `fake_quality_tier must be 1–4 (got ${JSON.stringify(raw.fake_quality_tier)})`, severity: "error" });
  }

  // content source
  if (modality === "text") {
    if (!nonEmpty(raw.text)) errors.push({ row, item_id: id, field: "text", message: "text item has no `text` content", severity: "error" });
  } else if (modality === "image") {
    if (!nonEmpty(raw.path) && !nonEmpty(raw.url)) {
      errors.push({ row, item_id: id, field: "path/url", message: "image item needs a `path` or `url`", severity: "error" });
    }
  }

  // provenance
  const provenance: Provenance = { source_type };
  if (source_type === "human") {
    provenance.rights = nonEmpty(raw.rights) ? raw.rights : undefined;
    provenance.source_ref = nonEmpty(raw.source_ref) ? raw.source_ref : undefined;
    // THE legal gate — loud, structured, its own severity.
    if (!nonEmpty(raw.rights) || !(VALID_RIGHTS as readonly string[]).includes(raw.rights!)) {
      errors.push({
        row,
        item_id: id,
        field: "rights",
        message: `HUMAN item missing/invalid rights — must be one of ${VALID_RIGHTS.join("|")} (got ${JSON.stringify(raw.rights)}). No scraped or unattributed content may be staged.`,
        severity: "legal",
      });
    }
    if (!nonEmpty(raw.source_ref)) {
      errors.push({ row, item_id: id, field: "source_ref", message: "HUMAN item missing source_ref (attribution required)", severity: "error" });
    }
  } else if (source_type === "ai") {
    provenance.created = nonEmpty(raw.created) ? raw.created : undefined;
    if (!nonEmpty(raw.generator_model)) {
      errors.push({ row, item_id: id, field: "generator_model", message: "AI item missing generator_model", severity: "error" });
    }
    if (!nonEmpty(raw.created)) {
      errors.push({ row, item_id: id, field: "created", message: "AI item missing generation date (`created`)", severity: "error" });
    }
  }

  // Canonical backstop: run the same validator CI uses; surface anything missed.
  if (modality && source_type) {
    const canon = validateFooledItem({ item_id: id ?? `row_${row}`, provenance, generator_model: nonEmpty(raw.generator_model) ? raw.generator_model : null });
    for (const msg of canon) {
      const already = errors.some((e) => msg.toLowerCase().includes(e.field.split("/")[0]));
      if (!already) errors.push({ row, item_id: id, field: "provenance", message: msg, severity: "error" });
    }
  }

  if (errors.length) return { errors };

  return {
    errors: [],
    draft: {
      row,
      modality,
      source_type,
      tier,
      text: modality === "text" ? raw.text!.trim() : undefined,
      path: nonEmpty(raw.path) ? raw.path : undefined,
      url: nonEmpty(raw.url) ? raw.url : undefined,
      provenance,
      generator_model: nonEmpty(raw.generator_model) ? raw.generator_model : null,
      item_id: id,
    },
  };
}

/** Resolve a stable id from the manifest or the content hash (dedup-friendly). */
export function resolveItemId(draft: RowDraft, contentHash: string): string {
  return draft.item_id ?? `fooled_${contentHash.slice(0, 12)}`;
}

/** Assemble the staged item_cache-shaped record. */
export function stagedFromDraft(draft: RowDraft, contentHash: string): StagedFooledItem {
  const item_id = resolveItemId(draft, contentHash);
  return {
    item_id,
    trial_type: "fooled",
    category: draft.modality,
    content: {
      fake_quality_tier: draft.tier,
      ...(draft.modality === "text" ? { text: draft.text } : { image_src: draft.url ?? draft.path }),
    },
    generator_model: draft.generator_model,
    provenance: draft.provenance,
    content_hash: contentHash,
    design_difficulty: draft.tier,
    status: "staged",
    source: { path: draft.path, url: draft.url },
  };
}

/**
 * Detect accidental duplicate ingestion: the SAME content hash under a DIFFERENT
 * item_id. Re-staging the same (id, hash) is idempotent and not a duplicate.
 */
export function findDuplicates(items: StagedFooledItem[]): RowError[] {
  const byHash = new Map<string, string>();
  const errors: RowError[] = [];
  items.forEach((it, i) => {
    const seen = byHash.get(it.content_hash);
    if (seen && seen !== it.item_id) {
      errors.push({ row: i + 1, item_id: it.item_id, field: "content_hash", message: `duplicate content — same hash as ${seen} (${it.content_hash.slice(0, 12)})`, severity: "error" });
    } else {
      byHash.set(it.content_hash, it.item_id);
    }
  });
  return errors;
}

// ── manifest parsing ────────────────────────────────────────────────────────
export function parseManifest(text: string, format?: "csv" | "json"): ManifestRow[] {
  const fmt = format ?? (text.trim().startsWith("[") || text.trim().startsWith("{") ? "json" : "csv");
  if (fmt === "json") {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : (data.rows ?? []);
  }
  return parseCsv(text);
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, "" escapes, CRLF). */
export function parseCsv(text: string): ManifestRow[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n") { record.push(field); rows.push(record); record = []; field = ""; }
    else field += c;
  }
  if (field.length || record.length) { record.push(field); rows.push(record); }

  const nonEmptyRows = rows.filter((r) => r.some((c) => c.trim().length));
  if (!nonEmptyRows.length) return [];
  const header = nonEmptyRows[0].map((h) => h.trim());
  return nonEmptyRows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj as ManifestRow;
  });
}

// ── export ──────────────────────────────────────────────────────────────────
export function fooledToCsv(items: StagedFooledItem[]): string {
  return airtableCsv(
    items.map((it) => ({
      item_id: it.item_id,
      trial_type: "fooled",
      content: JSON.stringify(it.content),
      design_difficulty: it.design_difficulty,
      category: it.category,
      generator_model: it.generator_model ?? "",
      provenance: JSON.stringify(it.provenance),
      status: "live", // approved items go live on sync
    }))
  );
}

// ── dashboard counts ─────────────────────────────────────────────────────────
export interface FooledCounts {
  total: number;
  bySourceModalityTier: Record<string, number>; // key: `${source}|${modality}|t${tier}`
  byTier: Record<1 | 2 | 3 | 4, number>;
  bySource: Record<SourceType, number>;
  byModality: Record<Modality, number>;
}

export function countItems(items: StagedFooledItem[]): FooledCounts {
  const c: FooledCounts = {
    total: items.length,
    bySourceModalityTier: {},
    byTier: { 1: 0, 2: 0, 3: 0, 4: 0 },
    bySource: { human: 0, ai: 0 },
    byModality: { image: 0, text: 0 },
  };
  for (const it of items) {
    const source = it.provenance.source_type as SourceType;
    const tier = it.content.fake_quality_tier as 1 | 2 | 3 | 4;
    const key = `${source}|${it.category}|t${tier}`;
    c.bySourceModalityTier[key] = (c.bySourceModalityTier[key] ?? 0) + 1;
    if (TIERS.has(tier)) c.byTier[tier] += 1;
    if (source === "human" || source === "ai") c.bySource[source] += 1;
    c.byModality[it.category] += 1;
  }
  return c;
}

/** Target: 200 image + 200 text = 400; 100/100 human/AI; ~25 per (src×mod×tier) cell. */
export const FOOLED_TARGET_TOTAL = 400;
export const TIER_MIN = 20; // warn if a tier is below this near completion
export const NEAR_DONE_FRACTION = 0.8;

export function undersizedTiers(counts: FooledCounts): (1 | 2 | 3 | 4)[] {
  return ([1, 2, 3, 4] as const).filter((t) => counts.byTier[t] < TIER_MIN);
}
