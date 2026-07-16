/**
 * Export approved fooled items to the Airtable → item_cache CSV format.
 *
 *   npx tsx scripts/export-fooled-approved.ts [out.csv]
 *
 * Reads data/fooled_bank_approved.json, writes the CSV (default
 * data/fooled_bank.csv) using the shared Airtable column format
 * (src/lib/dev/airtable-csv.ts) — same target as the alien_rules export.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fooledToCsv, type StagedFooledItem } from "../src/lib/dev/fooled-ingest";

const APPROVED_PATH = join(process.cwd(), "data", "fooled_bank_approved.json");
const outPath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(process.cwd(), "data", "fooled_bank.csv");

if (!existsSync(APPROVED_PATH)) {
  console.error(`No approved bank at ${APPROVED_PATH}. Approve items at /dev/author/fooled-review first.`);
  process.exit(1);
}

const items = JSON.parse(readFileSync(APPROVED_PATH, "utf8")) as StagedFooledItem[];
if (!items.length) {
  console.error("Approved bank is empty — nothing to export.");
  process.exit(1);
}

writeFileSync(outPath, fooledToCsv(items) + "\n", "utf8");
console.log(`✓ Exported ${items.length} approved item(s) → ${outPath}`);
console.log("  Bulk-import this CSV to the Airtable item bank; the hourly sync pulls it into item_cache.");
