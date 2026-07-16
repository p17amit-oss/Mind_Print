// DEV-ONLY API for the fooled review tool. Reads staged/approved banks and
// applies review actions. 404 in production. Not referenced by any cron/CI.
//
//   GET                              -> { staged, approved, countsStaged, countsApproved, undersized, nearDone }
//   POST { action:'approve', item_id }
//   POST { action:'reject', item_id, reason }
//   POST { action:'edit_tier', item_id, tier }
import type { NextApiRequest, NextApiResponse } from "next";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  countItems,
  FOOLED_TARGET_TOTAL,
  NEAR_DONE_FRACTION,
  undersizedTiers,
  type StagedFooledItem,
} from "@/lib/dev/fooled-ingest";

const STAGED = join(process.cwd(), "data", "fooled_bank_staged.json");
const APPROVED = join(process.cwd(), "data", "fooled_bank_approved.json");
const REJECTED_LOG = join(process.cwd(), "data", "fooled_rejected.log");

function load(path: string): StagedFooledItem[] {
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
}
function save(path: string, items: StagedFooledItem[]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(items, null, 2) + "\n", "utf8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "not found" });

  if (req.method === "GET") {
    const staged = load(STAGED);
    const approved = load(APPROVED);
    const countsApproved = countItems(approved);
    const nearDone = approved.length >= FOOLED_TARGET_TOTAL * NEAR_DONE_FRACTION;
    return res.status(200).json({
      staged,
      approved,
      countsStaged: countItems(staged),
      countsApproved,
      undersized: undersizedTiers(countsApproved),
      nearDone,
      target: FOOLED_TARGET_TOTAL,
    });
  }

  if (req.method === "POST") {
    const action = req.body?.action as string;
    const itemId = req.body?.item_id as string;
    const staged = load(STAGED);
    const idx = staged.findIndex((it) => it.item_id === itemId);

    if (action === "approve") {
      if (idx < 0) return res.status(404).json({ error: "not staged" });
      const [item] = staged.splice(idx, 1);
      const approved = load(APPROVED);
      const aIdx = approved.findIndex((it) => it.item_id === itemId);
      const promoted = { ...item, status: "live" as const };
      if (aIdx >= 0) approved[aIdx] = promoted;
      else approved.push(promoted);
      save(STAGED, staged);
      save(APPROVED, approved);
      return res.status(200).json({ ok: true });
    }

    if (action === "reject") {
      if (idx < 0) return res.status(404).json({ error: "not staged" });
      const [item] = staged.splice(idx, 1);
      save(STAGED, staged);
      mkdirSync(dirname(REJECTED_LOG), { recursive: true });
      const reason = (req.body?.reason as string) ?? "(no reason)";
      appendFileSync(
        REJECTED_LOG,
        `${new Date().toISOString()}\t${item.item_id}\t${item.category}\t${item.provenance.source_type}\ttier=${item.content.fake_quality_tier}\t${reason.replace(/\s+/g, " ")}\n`,
        "utf8"
      );
      return res.status(200).json({ ok: true });
    }

    if (action === "edit_tier") {
      if (idx < 0) return res.status(404).json({ error: "not staged" });
      const tier = Number(req.body?.tier);
      if (![1, 2, 3, 4].includes(tier)) return res.status(400).json({ error: "tier must be 1-4" });
      staged[idx].content.fake_quality_tier = tier;
      staged[idx].design_difficulty = tier;
      save(STAGED, staged);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "unknown action" });
  }

  return res.status(405).end();
}
