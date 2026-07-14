// Compliance: fooled item provenance (BUILD PROMPT Section 6.6).
// Human items MUST carry rights + source_ref (no scraped content, ever); AI items
// MUST carry generator_model + generation date. The CI check runs over the local
// seed bank; the same validator gates Airtable sync and gauntlet ingestion.
import { describe, expect, it } from "vitest";
import { validateFooledItem } from "@/lib/server/item-validation";
import { FOOLED_IMAGES, FOOLED_TEXTS } from "@/lib/trials/fooledbank";

describe("fooled provenance", () => {
  it("every seed-bank item passes validation", () => {
    for (const item of [...FOOLED_TEXTS, ...FOOLED_IMAGES]) {
      expect(validateFooledItem(item), item.item_id).toHaveLength(0);
    }
  });

  it("rejects human items missing rights", () => {
    const errs = validateFooledItem({
      item_id: "bad_human",
      provenance: { source_type: "human", source_ref: "x" },
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects human items with scraped/unknown rights", () => {
    const errs = validateFooledItem({
      item_id: "scraped",
      provenance: { source_type: "human", rights: "scraped", source_ref: "x" },
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects AI items missing generator_model or date", () => {
    expect(
      validateFooledItem({ item_id: "bad_ai", provenance: { source_type: "ai" } }).length
    ).toBeGreaterThan(0);
    expect(
      validateFooledItem({
        item_id: "ok_ai",
        provenance: { source_type: "ai", created: "2026-01" },
        generator_model: "gen-x",
      })
    ).toHaveLength(0);
  });
});
