/**
 * Ingest + validate a batch of fooled items into a local staging bank.
 *
 *   npx tsx scripts/ingest-fooled-batch.ts <manifest.csv|manifest.json> [--format csv|json]
 *
 * Manifest columns/fields per row:
 *   item_id?         optional; auto-derived from the content hash if omitted
 *   modality         'image' | 'text'
 *   source_type      'human' | 'ai'
 *   path | url       image source (local path resolved next to the manifest, or URL)
 *   text             inline text (text items)
 *   fake_quality_tier 1-4
 *   rights           human: 'licensed'|'public_domain'|'commissioned'  (MANDATORY)
 *   source_ref       human: attribution (MANDATORY)
 *   generator_model  ai: MANDATORY
 *   created          ai: generation date (MANDATORY)
 *
 * HARD RULE: a human item with empty/missing/invalid `rights` ABORTS the whole
 * batch loudly (nothing is staged). This is the one place a shortcut is real
 * legal exposure — the failure is impossible to miss, never a buried warning.
 *
 * Staging is atomic (all-or-nothing) and idempotent (re-running the same manifest
 * upserts by item_id and changes nothing).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  countItems,
  findDuplicates,
  parseManifest,
  resolveItemId,
  stagedFromDraft,
  validateRow,
  type RowDraft,
  type RowError,
  type StagedFooledItem,
} from "../src/lib/dev/fooled-ingest";

const STAGED_PATH = join(process.cwd(), "data", "fooled_bank_staged.json");
const APPROVED_PATH = join(process.cwd(), "data", "fooled_bank_approved.json");

function loadBank(path: string): StagedFooledItem[] {
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function hashForDraft(draft: RowDraft, manifestDir: string): Promise<{ hash?: string; error?: RowError }> {
  if (draft.modality === "text") {
    return { hash: sha256(draft.text ?? "") };
  }
  if (draft.path) {
    // Manifest paths are relative to the manifest file; resolve, then rewrite the
    // draft's path to be cwd-relative (or absolute) so downstream consumers (the
    // asset route, which resolves against cwd) find the file.
    const abs = isAbsolute(draft.path) ? draft.path : resolve(manifestDir, draft.path);
    if (!existsSync(abs)) {
      return { error: { row: draft.row, item_id: draft.item_id, field: "path", message: `image file not found: ${abs}`, severity: "error" } };
    }
    const rel = relative(process.cwd(), abs);
    draft.path = rel.startsWith("..") ? abs : rel;
    return { hash: sha256(readFileSync(abs)) };
  }
  if (draft.url) {
    try {
      const resp = await fetch(draft.url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const bytes = Buffer.from(await resp.arrayBuffer());
      return { hash: sha256(bytes) };
    } catch (e) {
      return { error: { row: draft.row, item_id: draft.item_id, field: "url", message: `could not fetch URL to hash (${(e as Error).message}) — provide a local path or fix the URL`, severity: "error" } };
    }
  }
  return { error: { row: draft.row, item_id: draft.item_id, field: "path/url", message: "no content source to hash", severity: "error" } };
}

function banner(lines: string[], legal: boolean) {
  const width = Math.max(60, ...lines.map((l) => l.length)) + 4;
  const bar = (legal ? "█" : "═").repeat(width);
  process.stderr.write("\n" + bar + "\n");
  for (const l of lines) process.stderr.write((legal ? "█ " : "║ ") + l.padEnd(width - 4) + (legal ? " █" : " ║") + "\n");
  process.stderr.write(bar + "\n\n");
}

async function main() {
  const manifestArg = process.argv[2];
  if (!manifestArg) {
    console.error("usage: tsx scripts/ingest-fooled-batch.ts <manifest.csv|manifest.json> [--format csv|json]");
    process.exit(2);
  }
  const fmtFlag = process.argv.includes("--format") ? (process.argv[process.argv.indexOf("--format") + 1] as "csv" | "json") : undefined;
  const manifestPath = resolve(process.cwd(), manifestArg);
  const manifestDir = dirname(manifestPath);
  const text = readFileSync(manifestPath, "utf8");
  const rows = parseManifest(text, fmtFlag);

  const errors: RowError[] = [];
  const drafts: RowDraft[] = [];
  for (let i = 0; i < rows.length; i++) {
    const v = validateRow(rows[i], i);
    if (v.errors.length) errors.push(...v.errors);
    else if (v.draft) drafts.push(v.draft);
  }

  // Compute hashes + assemble staged items for clean drafts.
  const newItems: StagedFooledItem[] = [];
  for (const draft of drafts) {
    const { hash, error } = await hashForDraft(draft, manifestDir);
    if (error) errors.push(error);
    else if (hash) newItems.push(stagedFromDraft(draft, hash));
  }

  // Merge (idempotent upsert by id) with existing staged, then dedup across the
  // full staged + approved set.
  const existingStaged = loadBank(STAGED_PATH);
  const approved = loadBank(APPROVED_PATH);
  const mergedMap = new Map(existingStaged.map((it) => [it.item_id, it]));
  for (const it of newItems) mergedMap.set(it.item_id, it);
  const mergedStaged = [...mergedMap.values()];
  const dupErrors = findDuplicates([...mergedStaged, ...approved]);

  const allErrors = [...errors, ...dupErrors];
  const legalErrors = allErrors.filter((e) => e.severity === "legal");
  const otherErrors = allErrors.filter((e) => e.severity !== "legal");

  if (allErrors.length) {
    if (legalErrors.length) {
      banner(
        [
          "⛔  RIGHTS / LEGAL FAILURE — BATCH REJECTED, NOTHING STAGED  ⛔",
          "",
          ...legalErrors.map((e) => `row ${e.row}${e.item_id ? ` (${e.item_id})` : ""}: ${e.message}`),
          "",
          "No human item may be staged without valid rights + attribution.",
        ],
        true
      );
    }
    if (otherErrors.length) {
      banner(["BATCH REJECTED — validation errors (nothing staged):", "", ...otherErrors.map((e) => `row ${e.row}${e.item_id ? ` (${e.item_id})` : ""} [${e.field}]: ${e.message}`)], false);
    }
    console.error(`Aborted: ${legalErrors.length} rights failure(s), ${otherErrors.length} other error(s). Fix the manifest and re-run. Nothing was staged.`);
    process.exit(1);
  }

  // Success — write atomically.
  mkdirSync(dirname(STAGED_PATH), { recursive: true });
  writeFileSync(STAGED_PATH, JSON.stringify(mergedStaged, null, 2) + "\n", "utf8");

  const counts = countItems(mergedStaged);
  console.log(`✓ Staged ${newItems.length} item(s) from ${rows.length} manifest row(s). Total staged: ${counts.total}.`);
  console.log(`  human ${counts.bySource.human} / ai ${counts.bySource.ai}  ·  image ${counts.byModality.image} / text ${counts.byModality.text}`);
  console.log(`  by tier — t1:${counts.byTier[1]} t2:${counts.byTier[2]} t3:${counts.byTier[3]} t4:${counts.byTier[4]}`);
  console.log(`  → ${STAGED_PATH}`);
  console.log(`  Review + approve at /dev/author/fooled-review (run \`next dev\`).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
