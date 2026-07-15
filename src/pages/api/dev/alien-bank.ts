// DEV-ONLY API for the alien_rules authoring tool. Reads/writes the local
// authoring bank at data/alien_rules_bank.json. Returns 404 in production so the
// filesystem-write endpoint never ships. Not referenced by any cron/CI.
//
//   GET                         -> { items: BankEntry[] }
//   POST { action:'save', entry }   -> upsert by item_id, returns { items }
//   POST { action:'delete', item_id } -> remove, returns { items }
import type { NextApiRequest, NextApiResponse } from "next";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BankEntry } from "@/lib/dev/alien-authoring";

const BANK_PATH = join(process.cwd(), "data", "alien_rules_bank.json");

function loadBank(): BankEntry[] {
  if (!existsSync(BANK_PATH)) return [];
  try {
    const raw = JSON.parse(readFileSync(BANK_PATH, "utf8"));
    return Array.isArray(raw) ? raw : (raw.items ?? []);
  } catch {
    return [];
  }
}

function saveBank(items: BankEntry[]) {
  mkdirSync(dirname(BANK_PATH), { recursive: true });
  writeFileSync(BANK_PATH, JSON.stringify(items, null, 2) + "\n", "utf8");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "not found" });
  }

  if (req.method === "GET") {
    return res.status(200).json({ items: loadBank() });
  }

  if (req.method === "POST") {
    const action = req.body?.action as string;
    const items = loadBank();

    if (action === "save") {
      const entry = req.body?.entry as BankEntry;
      if (!entry?.item_id) return res.status(400).json({ error: "entry.item_id required" });
      const idx = items.findIndex((e) => e.item_id === entry.item_id);
      if (idx >= 0) items[idx] = entry;
      else items.push(entry);
      saveBank(items);
      return res.status(200).json({ items });
    }
    if (action === "delete") {
      const id = req.body?.item_id as string;
      const next = items.filter((e) => e.item_id !== id);
      saveBank(next);
      return res.status(200).json({ items: next });
    }
    return res.status(400).json({ error: "unknown action" });
  }

  return res.status(405).end();
}
