// Compliance: under-18 users get zero research surface (BUILD PROMPT Sec 3/13).
// - research_participation is not grantable
// - no research prompt, no sponsored items
// - the SQL research views are gated on is_adult AND active consent
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canGrantResearch, isAdultBand } from "@/lib/consent";

describe("under-18 exclusion", () => {
  it("'<18' age band derives is_adult=false", () => {
    expect(isAdultBand("<18")).toBe(false);
    expect(isAdultBand("18-24")).toBe(true);
  });

  it("research consent is not grantable for minors or unknown age", () => {
    expect(canGrantResearch(false)).toBe(false);
    expect(canGrantResearch(null)).toBe(false);
    expect(canGrantResearch(true)).toBe(true);
  });

  it("every research view filters through the adult+consent predicate", () => {
    const sql = readFileSync(
      join(__dirname, "../../migrations/0003_research_views.sql"),
      "utf8"
    );
    // The eligibility view carries the predicate…
    expect(sql).toMatch(/is_adult = true/);
    expect(sql).toMatch(/consent_type = 'research_participation'/);
    expect(sql).toMatch(/revoked_at IS NULL/);
    // …and each research view joins through it.
    const views = ["v_detection_rates", "v_jury_distributions", "v_gauntlet_event_summary"];
    for (const v of views) {
      const body = sql.split(`CREATE OR REPLACE VIEW ${v}`)[1]?.split("CREATE OR REPLACE VIEW")[0] ?? "";
      expect(body, `${v} must join v_research_eligible_users`).toMatch(/v_research_eligible_users/);
    }
  });

  it("research views enforce n>=50 small-cell suppression", () => {
    const sql = readFileSync(
      join(__dirname, "../../migrations/0003_research_views.sql"),
      "utf8"
    );
    const matches = sql.match(/>= 50/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});
