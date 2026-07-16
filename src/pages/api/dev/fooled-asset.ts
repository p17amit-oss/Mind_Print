// DEV-ONLY: stream a staged/approved image item's local file for the review UI.
// 404 in production. Only serves files referenced by a staged/approved item's
// source.path (no arbitrary path traversal from the client).
import type { NextApiRequest, NextApiResponse } from "next";
import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import type { StagedFooledItem } from "@/lib/dev/fooled-ingest";

const BANKS = [
  join(process.cwd(), "data", "fooled_bank_staged.json"),
  join(process.cwd(), "data", "fooled_bank_approved.json"),
];

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === "production") return res.status(404).end();
  const itemId = req.query.item_id as string;
  if (!itemId) return res.status(400).end();

  let item: StagedFooledItem | undefined;
  for (const bank of BANKS) {
    if (!existsSync(bank)) continue;
    try {
      const items = JSON.parse(readFileSync(bank, "utf8")) as StagedFooledItem[];
      item = items.find((it) => it.item_id === itemId);
      if (item) break;
    } catch {
      /* ignore */
    }
  }
  // Only serve a path that an ingested item actually references.
  if (!item || item.category !== "image" || !item.source?.path) return res.status(404).end();

  const p = item.source.path;
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  if (!existsSync(abs)) return res.status(404).end();

  const mime = MIME[extname(abs).toLowerCase()] ?? "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(readFileSync(abs));
}
