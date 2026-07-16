// Authoring model + helpers for the alien_rules item tool (dev-only).
// Produces the EXACT content shape the trial + Airtable sync consume: an
// AlienItem whose `grid` is 9 cells with `null` at the hidden cell (the spec's
// "8 glyph specs" are the 8 non-null cells; the 9th is the missing cell). This
// is what item_cache.content must hold for the trial to render — see
// src/lib/server/items.ts (getItemsForTrial returns content verbatim).
import { DEFAULT_GLYPH, type AlienItem, type GlyphSpec } from "../glyphs/types";
import { detectRules } from "../glyphs/rule-detect";
import { airtableCsv } from "./airtable-csv";

export interface Distractor {
  spec: GlyphSpec;
  /**
   * Author-assigned proximity 0..2 — how close this distractor LOOKS to right:
   * 0 = obviously wrong, 1 = plausible, 2 = near-miss (subtle). This is the
   * difficulty-spread control; a strong item uses distinct proximities. Whether
   * a distractor is actually broken (satisfies all rules) is auto-checked
   * against the rule engine, not from this tag.
   */
  proximity: 0 | 1 | 2;
}

export interface AuthoringState {
  /** All 9 cells composed, including the hidden cell's intended (correct) glyph. */
  grid: GlyphSpec[];
  hiddenIndex: number; // 0..8, default 8 (bottom-right, Raven convention)
  distractors: Distractor[]; // exactly 3
  rule_depth: 1 | 2 | 3;
  distractor_proximity: 0 | 1 | 2;
}

export interface BankEntry {
  item_id: string;
  trial_type: "alien_rules";
  design_difficulty: number;
  category: null;
  status: "live";
  content: AlienItem;
  /** Editor state, for re-loading an item to edit. Stripped from CSV/import. */
  authoring: AuthoringState;
}

export function blankState(): AuthoringState {
  return {
    grid: Array.from({ length: 9 }, () => ({ ...DEFAULT_GLYPH })),
    hiddenIndex: 8,
    distractors: [
      { spec: { ...DEFAULT_GLYPH, shape: "square" }, proximity: 0 },
      { spec: { ...DEFAULT_GLYPH, shape: "triangle" }, proximity: 1 },
      { spec: { ...DEFAULT_GLYPH, shape: "star" }, proximity: 2 },
    ],
    rule_depth: 1,
    distractor_proximity: 2,
  };
}

export function specEqual(a: GlyphSpec, b: GlyphSpec): boolean {
  return (
    a.shape === b.shape &&
    a.count === b.count &&
    Math.abs(a.size - b.size) < 1e-6 &&
    a.rotation === b.rotation &&
    a.fill === b.fill &&
    a.color === b.color
  );
}

/** Next stable id: alien_001, alien_002, … (max existing suffix + 1). */
export function nextItemId(entries: BankEntry[]): string {
  let max = 0;
  for (const e of entries) {
    const m = /^alien_(\d+)$/.exec(e.item_id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `alien_${String(max + 1).padStart(3, "0")}`;
}

/** Suggested item distractor_proximity = the hardest (closest) distractor present. */
export function suggestProximity(distractors: Distractor[]): 0 | 1 | 2 {
  return Math.max(0, ...distractors.map((d) => d.proximity)) as 0 | 1 | 2;
}

/** design_difficulty (1–5) from depth + proximity — feeds the serving ladder. */
export function deriveDesignDifficulty(depth: number, proximity: number): number {
  return Math.max(1, Math.min(5, depth + Math.max(0, proximity - 1)));
}

/** Build the export-ready AlienItem, shuffling options so the answer isn't fixed at 0. */
export function buildContent(state: AuthoringState, rand: () => number = Math.random): AlienItem {
  const correct = state.grid[state.hiddenIndex];
  const grid: (GlyphSpec | null)[] = state.grid.map((s, i) => (i === state.hiddenIndex ? null : s));
  const opts: { spec: GlyphSpec; correct: boolean }[] = [
    { spec: correct, correct: true },
    ...state.distractors.map((d) => ({ spec: d.spec, correct: false })),
  ];
  // deterministic-enough shuffle
  const shuffled = opts
    .map((o) => ({ o, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.o);
  return {
    grid,
    options: shuffled.map((o) => o.spec),
    correct_index: shuffled.findIndex((o) => o.correct),
    rule_depth: state.rule_depth,
    distractor_proximity: state.distractor_proximity,
  };
}

export function entryFromState(state: AuthoringState, itemId: string): BankEntry {
  return {
    item_id: itemId,
    trial_type: "alien_rules",
    design_difficulty: deriveDesignDifficulty(state.rule_depth, state.distractor_proximity),
    category: null,
    status: "live",
    content: buildContent(state),
    authoring: state,
  };
}

export interface AuthoringWarning {
  level: "error" | "warn" | "info";
  text: string;
}

/**
 * How many detected rules a distractor breaks, computed by substituting it into
 * the hidden cell and comparing the rule report to the correct completion. A
 * distractor that breaks 0 detected rules satisfies the grid as well as the
 * correct answer → the item is broken/ambiguous.
 */
export function distractorRuleBreaks(state: AuthoringState, distractorSpec: GlyphSpec): number {
  const correctReport = detectRules(state.grid);
  const test = state.grid.map((s, i) => (i === state.hiddenIndex ? distractorSpec : s));
  const testReport = detectRules(test);
  return Math.max(0, correctReport.activeCount - testReport.activeCount);
}

/** Design-QA warnings. Errors mark a broken item; warns are weak design. */
export function warnings(state: AuthoringState): AuthoringWarning[] {
  const out: AuthoringWarning[] = [];
  const correct = state.grid[state.hiddenIndex];
  const report = detectRules(state.grid);

  if (!report.anyClear) {
    out.push({ level: "warn", text: "No clear rule detected yet — the grid may be ambiguous." });
  }
  if (report.suggestedDepth && report.suggestedDepth !== state.rule_depth) {
    out.push({
      level: "info",
      text: `You set rule_depth ${state.rule_depth}, but ${report.activeCount} rule(s) were detected (suggested depth ${report.suggestedDepth}).`,
    });
  }

  // Distractor checks.
  state.distractors.forEach((d, i) => {
    if (specEqual(d.spec, correct)) {
      out.push({ level: "error", text: `Distractor ${i + 1} is identical to the correct answer (item is broken).` });
      return;
    }
    // Auto broken-check: does this distractor break at least one detected rule?
    if (report.anyClear && distractorRuleBreaks(state, d.spec) === 0) {
      out.push({
        level: "error",
        text: `Distractor ${i + 1} satisfies every detected rule — it's as valid as the correct answer (item is broken).`,
      });
    }
  });

  // Proximity spread: distinct 0/1/2 is achievable and stronger.
  const tags = state.distractors.map((d) => d.proximity);
  if (new Set(tags).size < tags.length) {
    out.push({ level: "warn", text: "Two distractors share the same proximity — spread them across 0/1/2 for a stronger item." });
  }
  // Duplicate distractor glyphs.
  for (let i = 0; i < state.distractors.length; i++) {
    for (let j = i + 1; j < state.distractors.length; j++) {
      if (specEqual(state.distractors[i].spec, state.distractors[j].spec)) {
        out.push({ level: "warn", text: `Distractors ${i + 1} and ${j + 1} are identical.` });
      }
    }
  }
  return out;
}

// ── CSV export matching the Airtable → item_cache sync columns ──────────────
export function toCsv(entries: BankEntry[]): string {
  return airtableCsv(
    entries.map((e) => ({
      item_id: e.item_id,
      trial_type: e.trial_type,
      content: JSON.stringify(e.content), // content JSON (asJson() parses on sync)
      design_difficulty: e.design_difficulty,
      status: e.status,
    }))
  );
}

export function depthBreakdown(entries: BankEntry[]): Record<1 | 2 | 3, number> {
  const b: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  for (const e of entries) b[e.content.rule_depth] = (b[e.content.rule_depth] ?? 0) + 1;
  return b;
}
