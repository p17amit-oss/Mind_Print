// Compliance: the two-room wall (BUILD PROMPT Sections 13/15).
// No user-level data export endpoint exists anywhere in this codebase. This test
// walks every API route and rejects patterns that would ship user-level rows
// across users to a caller.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const API_DIR = join(__dirname, "../../src/pages/api");
const ROOT = join(__dirname, "../..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("two-room wall", () => {
  const files = walk(API_DIR);

  it("has API routes to inspect", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no route name suggests export/dump/download of data", () => {
    for (const f of files) {
      const rel = relative(ROOT, f);
      expect(rel).not.toMatch(/export|dump|download|extract/i);
    }
  });

  it("no route selects raw per-user rows across users (device_id/email leak)", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // No API route may return device_id or email columns.
      expect(src, relative(ROOT, f)).not.toMatch(/SELECT[^;]*\b(device_id|email)\b/is);
    }
  });

  it("no route reads events/runs for a user other than the authenticated one", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const rel = relative(ROOT, f);
      // Internal ops jobs (cron/admin, bearer-token protected) may iterate users
      // to recompute scores; they respond with counts, never rows. The
      // device_id/email leak assertion above still covers them.
      if (/requireAuth\(req,\s*res,\s*"(cron|admin)"\)/.test(src)) continue;
      // Cross-user reads are only allowed as aggregates. Heuristic: any SELECT
      // over runs/events must either scope by an authenticated user/session id
      // or be an aggregate (count/avg/sum) — never "all rows".
      const selects = src.match(/SELECT[\s\S]*?FROM\s+(runs|events)\b[\s\S]*?(?=`)/gi) ?? [];
      for (const q of selects) {
        const scoped = /(user_id|session_id|run_id|e\.run_id)\s*=\s*\$/.test(q) || /r\.id = e\.run_id/.test(q);
        const aggregate = /\b(count|avg|sum|stddev_samp)\s*\(/i.test(q);
        expect(scoped || aggregate, `${rel} has an unscoped non-aggregate read:\n${q}`).toBe(true);
      }
    }
  });
});
