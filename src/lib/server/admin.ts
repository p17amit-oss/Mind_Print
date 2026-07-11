// Shared bearer-token guard for ops/admin/cron routes.
import type { NextApiRequest, NextApiResponse } from "next";

function bearer(req: NextApiRequest): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7).trim();
  // Vercel Cron sends the secret via this header.
  const cron = req.headers["x-vercel-cron"];
  if (typeof cron === "string" && cron) return process.env.CRON_SECRET ?? null;
  return null;
}

/** Returns true if the request carries a valid token for `which`. */
export function authorize(req: NextApiRequest, which: "admin" | "cron"): boolean {
  const expected = which === "admin" ? process.env.ADMIN_TOKEN : process.env.CRON_SECRET;
  if (!expected) return false;
  return bearer(req) === expected;
}

export function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse,
  which: "admin" | "cron"
): boolean {
  if (!authorize(req, which)) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}
