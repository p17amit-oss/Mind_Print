// Unit coverage for the alien_rules authoring logic (dev tool).
import { describe, expect, it } from "vitest";
import { DEFAULT_GLYPH, type GlyphSpec } from "@/lib/glyphs/types";
import { detectRules } from "@/lib/glyphs/rule-detect";
import {
  blankState,
  buildContent,
  deriveDesignDifficulty,
  nextItemId,
  suggestProximity,
  toCsv,
  warnings,
  entryFromState,
  type AuthoringState,
} from "@/lib/dev/alien-authoring";

const g = (patch: Partial<GlyphSpec>): GlyphSpec => ({ ...DEFAULT_GLYPH, ...patch });

describe("rule detection", () => {
  it("detects a single count progression (left→right), others constant", () => {
    const grid = Array.from({ length: 9 }, (_, i) => g({ count: (i % 3) + 1 }));
    const r = detectRules(grid);
    expect(r.anyClear).toBe(true);
    expect(r.activeCount).toBe(1);
    expect(r.suggestedDepth).toBe(1);
    const countRule = r.active.find((x) => x.feature === "count");
    expect(countRule?.kind).toBe("row_progression");
  });

  it("detects two composed rules (count progression + rotation progression)", () => {
    const grid = Array.from({ length: 9 }, (_, i) =>
      g({ count: (i % 3) + 1, rotation: Math.floor(i / 3) * 45 })
    );
    const r = detectRules(grid);
    expect(r.activeCount).toBe(2);
    expect(r.suggestedDepth).toBe(2);
  });

  it("flags a random-ish grid as no clear rule", () => {
    const shapes = ["circle", "star", "hexagon", "square", "triangle", "ring", "diamond", "circle", "star"] as const;
    const grid = shapes.map((s, i) => g({ shape: s, count: [1, 3, 2, 2, 1, 4, 1, 2, 3][i], rotation: [0, 90, 45, 180, 0, 270, 45, 135, 90][i] }));
    const r = detectRules(grid);
    expect(r.anyClear).toBe(false);
  });
});

describe("content build", () => {
  it("produces a 9-cell grid with exactly one null at the hidden index and 4 options", () => {
    const s = blankState();
    s.hiddenIndex = 8;
    const content = buildContent(s, () => 0.5);
    expect(content.grid).toHaveLength(9);
    expect(content.grid[8]).toBeNull();
    expect(content.grid.filter((x) => x !== null)).toHaveLength(8);
    expect(content.options).toHaveLength(4);
    // correct_index points to the hidden cell's glyph
    expect(content.options[content.correct_index]).toEqual(s.grid[8]);
  });
});

// Build a real depth-1 item (count progresses 1,2,3 per row; hidden = cell 8).
function countProgressionState() {
  const s = blankState();
  s.grid = Array.from({ length: 9 }, (_, i) => g({ count: (i % 3) + 1 }));
  s.hiddenIndex = 8; // correct answer is count=3
  // distractors that DO break the count rule (count != 3)
  s.distractors = [
    { spec: g({ count: 1 }), proximity: 0 },
    { spec: g({ count: 2, shape: "square" }), proximity: 1 },
    { spec: g({ count: 1, color: "gold" }), proximity: 2 },
  ];
  return s;
}

describe("warnings", () => {
  it("errors when a distractor satisfies every detected rule (ambiguous item)", () => {
    const s = countProgressionState();
    // count=3 satisfies the ONLY active rule (count progression); differing only
    // on colour — which no rule governs — makes it an equally-valid answer.
    s.distractors[0].spec = g({ count: 3, color: "gold" });
    expect(warnings(s).some((w) => w.level === "error" && /satisfies every detected rule/.test(w.text))).toBe(true);
  });

  it("passes a well-formed item with distinct proximities and rule-breaking distractors", () => {
    const s = countProgressionState();
    expect(warnings(s).some((w) => w.level === "error")).toBe(false);
  });

  it("errors when a distractor equals the correct answer", () => {
    const s = countProgressionState();
    s.distractors[0].spec = { ...s.grid[s.hiddenIndex] };
    expect(warnings(s).some((w) => w.level === "error" && /identical/.test(w.text))).toBe(true);
  });

  it("warns when two distractors share the same proximity", () => {
    const s = countProgressionState();
    s.distractors[0].proximity = 2;
    s.distractors[1].proximity = 2;
    s.distractors[2].proximity = 1;
    expect(warnings(s).some((w) => /same proximity/.test(w.text))).toBe(true);
  });
});

describe("helpers", () => {
  it("suggests item proximity from the hardest distractor present", () => {
    const s = blankState();
    s.distractors = [
      { spec: g({}), proximity: 0 },
      { spec: g({}), proximity: 1 },
      { spec: g({}), proximity: 2 },
    ];
    expect(suggestProximity(s.distractors)).toBe(2);
  });

  it("derives design_difficulty in 1..5", () => {
    expect(deriveDesignDifficulty(1, 0)).toBe(1);
    expect(deriveDesignDifficulty(3, 2)).toBe(4);
  });

  it("generates stable, incrementing ids", () => {
    expect(nextItemId([])).toBe("alien_001");
    const e = entryFromState(blankState(), "alien_007");
    expect(nextItemId([e])).toBe("alien_008");
  });
});

describe("CSV export", () => {
  it("matches the Airtable sync columns and embeds parseable content JSON", () => {
    const e = entryFromState(blankState(), "alien_001");
    const csv = toCsv([e]);
    const [header, row] = csv.split("\n");
    expect(header).toBe(
      "item_id,trial_type,content,design_difficulty,category,generator_model,provenance,sponsor,gauntlet_event_id,status"
    );
    // content column is quoted JSON; extract and parse it
    const m = /^alien_001,alien_rules,"(.*)",\d/.exec(row);
    expect(m).toBeTruthy();
    const json = JSON.parse(m![1].replace(/""/g, '"'));
    expect(json.options).toHaveLength(4);
    expect(json.grid).toHaveLength(9);
  });
});
