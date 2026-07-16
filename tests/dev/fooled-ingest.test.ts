// Unit coverage for fooled batch ingestion (BUILD PROMPT Section 6.6).
// The rights gate is legally load-bearing — these tests lock it.
import { describe, expect, it } from "vitest";
import {
  countItems,
  findDuplicates,
  fooledToCsv,
  parseManifest,
  parseCsv,
  stagedFromDraft,
  undersizedTiers,
  validateRow,
  type ManifestRow,
  type StagedFooledItem,
} from "@/lib/dev/fooled-ingest";

const humanText: ManifestRow = {
  modality: "text",
  source_type: "human",
  text: "A short human passage.",
  fake_quality_tier: "2",
  rights: "licensed",
  source_ref: "contrib/x",
};
const aiText: ManifestRow = {
  modality: "text",
  source_type: "ai",
  text: "An AI passage.",
  fake_quality_tier: "3",
  generator_model: "textgen-a-v3",
  created: "2026-01",
};

describe("the rights gate (legal)", () => {
  it("REJECTS a human item with missing rights, as severity 'legal', with the row number", () => {
    const { errors, draft } = validateRow({ ...humanText, rights: "" }, 41);
    expect(draft).toBeUndefined();
    const legal = errors.find((e) => e.severity === "legal");
    expect(legal).toBeTruthy();
    expect(legal!.row).toBe(42); // 1-based
    expect(legal!.field).toBe("rights");
  });

  it("REJECTS a human item with rights outside the enum (no scraped content)", () => {
    const { errors } = validateRow({ ...humanText, rights: "scraped" }, 0);
    expect(errors.some((e) => e.severity === "legal")).toBe(true);
  });

  it("REJECTS a human item missing source_ref", () => {
    const { errors } = validateRow({ ...humanText, source_ref: "" }, 0);
    expect(errors.some((e) => e.field === "source_ref")).toBe(true);
  });

  it("ACCEPTS a well-formed human item", () => {
    const { errors, draft } = validateRow(humanText, 0);
    expect(errors).toHaveLength(0);
    expect(draft?.provenance.rights).toBe("licensed");
  });
});

describe("AI provenance", () => {
  it("rejects an AI item missing generator_model", () => {
    const { errors } = validateRow({ ...aiText, generator_model: "" }, 0);
    expect(errors.some((e) => e.field === "generator_model")).toBe(true);
  });
  it("rejects an AI item missing created date", () => {
    const { errors } = validateRow({ ...aiText, created: "" }, 0);
    expect(errors.some((e) => e.field === "created")).toBe(true);
  });
  it("accepts a well-formed AI item", () => {
    const { errors } = validateRow(aiText, 0);
    expect(errors).toHaveLength(0);
  });
});

describe("shape + tier + content-source validation", () => {
  it("rejects bad modality / source_type / tier", () => {
    expect(validateRow({ ...humanText, modality: "video" }, 0).errors.some((e) => e.field === "modality")).toBe(true);
    expect(validateRow({ ...humanText, source_type: "bot" }, 0).errors.some((e) => e.field === "source_type")).toBe(true);
    expect(validateRow({ ...humanText, fake_quality_tier: 9 }, 0).errors.some((e) => e.field === "fake_quality_tier")).toBe(true);
  });
  it("requires text for text items and path/url for image items", () => {
    expect(validateRow({ ...humanText, text: "" }, 0).errors.some((e) => e.field === "text")).toBe(true);
    expect(validateRow({ modality: "image", source_type: "human", rights: "licensed", source_ref: "x", fake_quality_tier: 1 }, 0).errors.some((e) => e.field === "path/url")).toBe(true);
  });
});

describe("dedup by content hash", () => {
  it("flags the same hash under a different item_id, but not idempotent re-stages", () => {
    const a = stagedFromDraft(validateRow(humanText, 0).draft!, "hashAAAA0000");
    const b = { ...a, item_id: "fooled_other" }; // different id, same hash → duplicate
    const c = { ...a }; // same id, same hash → idempotent, not a dup
    expect(findDuplicates([a, b])).toHaveLength(1);
    expect(findDuplicates([a, c])).toHaveLength(0);
  });
});

describe("manifest parsing", () => {
  it("parses JSON and CSV to the same rows", () => {
    const json = parseManifest(JSON.stringify([humanText]));
    expect(json[0].rights).toBe("licensed");
    const csv = parseCsv('modality,source_type,text,fake_quality_tier,rights,source_ref\ntext,human,"Hi, there",2,licensed,ref/1');
    expect(csv[0].text).toBe("Hi, there"); // quoted comma preserved
    expect(csv[0].rights).toBe("licensed");
  });
});

describe("CSV export + counts", () => {
  it("exports the Airtable columns with fooled fields populated", () => {
    const item = stagedFromDraft(validateRow(humanText, 0).draft!, "deadbeef1234");
    const csv = fooledToCsv([item]);
    const [header, row] = csv.split("\n");
    expect(header).toBe("item_id,trial_type,content,design_difficulty,category,generator_model,provenance,sponsor,gauntlet_event_id,status");
    expect(row).toMatch(/,fooled,/);
    expect(row).toMatch(/,text,/); // category
    expect(row).toMatch(/,live$/);
  });

  it("counts by source×modality×tier and flags undersized tiers", () => {
    const items: StagedFooledItem[] = [
      stagedFromDraft(validateRow(humanText, 0).draft!, "h1"),
      stagedFromDraft(validateRow(aiText, 0).draft!, "a1"),
    ];
    const c = countItems(items);
    expect(c.total).toBe(2);
    expect(c.bySource.human).toBe(1);
    expect(c.bySource.ai).toBe(1);
    expect(undersizedTiers(c)).toEqual([1, 2, 3, 4]); // all below 20
  });
});
