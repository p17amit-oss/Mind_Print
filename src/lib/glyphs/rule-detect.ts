// Heuristic rule detection for a full 3×3 glyph matrix (authoring aid only —
// NOT a scoring system). Given the complete matrix (all 9 cells composed,
// including the cell that will be hidden), it guesses the pattern per feature so
// the author can see whether a clear rule exists and how many rules compose the
// item. Approximate by design; it flags when no clear rule is detected.
import {
  GLYPH_COLORS,
  GLYPH_FILLS,
  GLYPH_SHAPES,
  type GlyphSpec,
} from "./types";

export type FeatureKey = "shape" | "count" | "fill" | "rotation" | "color" | "size";

const FEATURES: FeatureKey[] = ["shape", "count", "fill", "rotation", "color", "size"];

// Cyclic wrap length per feature (for progression-with-wrap); undefined = no wrap.
const WRAP: Partial<Record<FeatureKey, number>> = {
  rotation: 360,
  shape: GLYPH_SHAPES.length,
  fill: GLYPH_FILLS.length,
  color: GLYPH_COLORS.length,
};

function encode(spec: GlyphSpec, f: FeatureKey): number {
  switch (f) {
    case "count":
      return spec.count;
    case "size":
      return spec.size;
    case "rotation":
      return ((spec.rotation % 360) + 360) % 360;
    case "shape":
      return GLYPH_SHAPES.indexOf(spec.shape);
    case "fill":
      return GLYPH_FILLS.indexOf(spec.fill);
    case "color":
      return GLYPH_COLORS.indexOf(spec.color);
  }
}

const ROWS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
];
const COLS = [
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
];

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;
function diff(a: number, b: number, wrap?: number): number {
  const d = b - a;
  return wrap ? ((d % wrap) + wrap) % wrap : d;
}

export type RuleKind =
  | "constant"
  | "row_progression"
  | "col_progression"
  | "latin"
  | "distribution_rows"
  | "distribution_cols"
  | "col_parity"
  | "row_parity"
  | "row_constant"
  | "col_constant"
  | "none";

export interface DetectedRule {
  feature: FeatureKey;
  kind: RuleKind;
  description: string;
}

export interface RuleReport {
  rules: DetectedRule[]; // one entry per feature (incl. constant/none)
  active: DetectedRule[]; // meaningful varying rules only
  activeCount: number;
  suggestedDepth: 1 | 2 | 3 | null; // clamp(activeCount, 1..3); null if 0
  anyClear: boolean;
}

function allEqual(vals: number[]): boolean {
  return vals.every((v) => eq(v, vals[0]));
}
function groupsAllEqual(groups: number[][], vals: number[]): boolean {
  return groups.every((g) => allEqual(g.map((i) => vals[i])));
}
function multiset(nums: number[]): string {
  return [...nums].sort((a, b) => a - b).map((n) => n.toFixed(3)).join(",");
}
function distinct3(nums: number[]): boolean {
  const s = new Set(nums.map((n) => n.toFixed(3)));
  return s.size === 3;
}

function progression(groups: number[][], vals: number[], wrap?: number): number | null {
  // Each group must advance by the SAME nonzero step; step equal across groups.
  let step: number | null = null;
  for (const g of groups) {
    const s1 = diff(vals[g[0]], vals[g[1]], wrap);
    const s2 = diff(vals[g[1]], vals[g[2]], wrap);
    if (!eq(s1, s2)) return null; // not linear within this group
    if (eq(s1, 0) || (wrap && eq(s1, wrap))) return null; // no movement
    if (step === null) step = s1;
    else if (!eq(step, s1)) return null; // step differs across groups
  }
  return step;
}

function parity(groups: number[][], vals: number[]): boolean {
  // In every group, ends match and middle differs (value depends on position parity).
  return groups.every((g) => {
    const a = vals[g[0]], b = vals[g[1]], c = vals[g[2]];
    return eq(a, c) && !eq(a, b);
  });
}

function distribution(groups: number[][], vals: number[]): boolean {
  // Every group is a permutation of the same 3 distinct values.
  const sets = groups.map((g) => g.map((i) => vals[i]));
  if (!sets.every(distinct3)) return false;
  const sig = multiset(sets[0]);
  return sets.every((s) => multiset(s) === sig);
}

function analyzeFeature(spec9: GlyphSpec[], f: FeatureKey): DetectedRule {
  const vals = spec9.map((s) => encode(s, f));
  const wrap = WRAP[f];
  const label = f;

  if (allEqual(vals)) return { feature: f, kind: "constant", description: `${label}: constant everywhere` };

  const rowStep = progression(ROWS, vals, wrap);
  if (rowStep !== null)
    return { feature: f, kind: "row_progression", description: `${label}: progresses left→right (${describeStep(f, rowStep)})` };

  const colStep = progression(COLS, vals, wrap);
  if (colStep !== null)
    return { feature: f, kind: "col_progression", description: `${label}: progresses top→bottom (${describeStep(f, colStep)})` };

  // Latin square: rows AND cols each hold the 3 distinct values.
  if (distribution(ROWS, vals) && distribution(COLS, vals) && multiset(ROWS[0].map((i) => vals[i])) === multiset(COLS[0].map((i) => vals[i])))
    return { feature: f, kind: "latin", description: `${label}: every row and column uses each value once (Latin)` };
  if (distribution(ROWS, vals))
    return { feature: f, kind: "distribution_rows", description: `${label}: each row uses all three values once (distribution)` };
  if (distribution(COLS, vals))
    return { feature: f, kind: "distribution_cols", description: `${label}: each column uses all three values once (distribution)` };

  if (parity(COLS, vals)) return { feature: f, kind: "col_parity", description: `${label}: follows column parity (outer columns match)` };
  if (parity(ROWS, vals)) return { feature: f, kind: "row_parity", description: `${label}: follows row parity (outer rows match)` };

  if (groupsAllEqual(ROWS, vals)) return { feature: f, kind: "row_constant", description: `${label}: constant within each row (varies by row)` };
  if (groupsAllEqual(COLS, vals)) return { feature: f, kind: "col_constant", description: `${label}: constant within each column (varies by column)` };

  return { feature: f, kind: "none", description: `${label}: varies with no clear rule` };
}

function describeStep(f: FeatureKey, step: number): string {
  if (f === "rotation") return `+${step}° per step`;
  if (f === "count") return `${step > 0 ? "+" : ""}${step} per step`;
  if (f === "size") return `${step > 0 ? "+" : ""}${step.toFixed(2)} per step`;
  const names: Record<string, readonly string[]> = { shape: GLYPH_SHAPES, fill: GLYPH_FILLS, color: GLYPH_COLORS };
  const seq = names[f];
  return seq ? `cycles ${step > 0 ? "forward" : "backward"} through ${f}s` : `${step} per step`;
}

/**
 * Run detection over a full 9-cell grid. `spec9` must have all 9 cells composed
 * (the intended-answer cell included) so rules that terminate in the hidden cell
 * are still detected.
 */
export function detectRules(spec9: (GlyphSpec | null)[]): RuleReport {
  if (spec9.some((s) => s == null) || spec9.length !== 9) {
    return { rules: [], active: [], activeCount: 0, suggestedDepth: null, anyClear: false };
  }
  const full = spec9 as GlyphSpec[];
  const rules = FEATURES.map((f) => analyzeFeature(full, f));
  const active = rules.filter((r) => r.kind !== "constant" && r.kind !== "none");
  const activeCount = active.length;
  const suggestedDepth = activeCount === 0 ? null : (Math.min(3, activeCount) as 1 | 2 | 3);
  return { rules, active, activeCount, suggestedDepth, anyClear: activeCount > 0 };
}
