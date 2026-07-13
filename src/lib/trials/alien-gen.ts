// Procedural alien_rules matrix generator (BUILD PROMPT Section 6.4).
// Produces well-formed 3×3 rule matrices from orthogonal glyph features so the
// trial is playable without the Airtable bank. Airtable items (when present)
// take precedence and flow through the same AlienItem shape.
import {
  GLYPH_COLORS,
  GLYPH_FILLS,
  GLYPH_SHAPES,
  type AlienItem,
  type GlyphColor,
  type GlyphFill,
  type GlyphShape,
  type GlyphSpec,
} from "../glyphs/types";

type Rand = () => number;
type Feature = "count" | "shape" | "color" | "fill" | "rotation";
type RuleKind = "col" | "row" | "diag";

const SEQUENCES: Record<Feature, unknown[]> = {
  count: [1, 2, 3],
  shape: ["circle", "square", "triangle"] as GlyphShape[],
  color: ["whiteblue", "teal", "gold"] as GlyphColor[],
  fill: ["none", "solid", "lines"] as GlyphFill[],
  rotation: [0, 45, 90],
};

const ALL_FEATURES: Feature[] = ["count", "shape", "color", "fill", "rotation"];

function pick<T>(arr: T[], rand: Rand): T {
  return arr[Math.floor(rand() * arr.length)];
}

function ruleValue(kind: RuleKind, row: number, col: number, seq: unknown[]): unknown {
  const idx = kind === "col" ? col : kind === "row" ? row : (row + col) % 3;
  return seq[idx % seq.length];
}

function buildSpec(
  row: number,
  col: number,
  varying: { feature: Feature; kind: RuleKind }[],
  constants: Partial<GlyphSpec>
): GlyphSpec {
  const spec: GlyphSpec = {
    shape: (constants.shape ?? "circle") as GlyphShape,
    count: constants.count ?? 1,
    size: constants.size ?? 0.85,
    rotation: constants.rotation ?? 0,
    fill: (constants.fill ?? "solid") as GlyphFill,
    color: (constants.color ?? "whiteblue") as GlyphColor,
  };
  for (const { feature, kind } of varying) {
    const v = ruleValue(kind, row, col, SEQUENCES[feature]);
    (spec as unknown as Record<string, unknown>)[feature] = v;
  }
  return spec;
}

function specsEqual(a: GlyphSpec, b: GlyphSpec): boolean {
  return (
    a.shape === b.shape &&
    a.count === b.count &&
    a.fill === b.fill &&
    a.color === b.color &&
    a.rotation === b.rotation
  );
}

function perturb(spec: GlyphSpec, proximity: 0 | 1 | 2, rand: Rand): GlyphSpec {
  const out = { ...spec };
  const nChanges = proximity === 2 ? 1 : proximity === 1 ? 1 : 2;
  const feats = [...ALL_FEATURES].sort(() => rand() - 0.5).slice(0, nChanges);
  for (const f of feats) {
    if (f === "count") out.count = ((out.count % 3) + 1) as number;
    else if (f === "shape") out.shape = pick(GLYPH_SHAPES.slice(0, 3) as GlyphShape[], rand);
    else if (f === "color") out.color = pick(GLYPH_COLORS.slice(0, 3) as GlyphColor[], rand);
    else if (f === "fill") out.fill = pick(GLYPH_FILLS as unknown as GlyphFill[], rand);
    else if (f === "rotation") out.rotation = (out.rotation + 45) % 180;
  }
  return specsEqual(out, spec) ? perturb(spec, proximity, rand) : out;
}

export function generateAlienItem(
  designDifficulty: number,
  rand: Rand = Math.random
): AlienItem {
  const depth = (Math.min(3, Math.max(1, Math.round(designDifficulty / 2 + 0.5))) as 1 | 2 | 3);
  const proximity = (Math.min(2, Math.max(0, depth - 1)) as 0 | 1 | 2);

  const chosenFeatures = [...ALL_FEATURES].sort(() => rand() - 0.5).slice(0, depth);
  const varying = chosenFeatures.map((feature) => ({
    feature,
    kind: pick<RuleKind>(["col", "row", "diag"], rand),
  }));
  const constants: Partial<GlyphSpec> = {
    shape: pick(GLYPH_SHAPES.slice(0, 3) as GlyphShape[], rand),
    color: pick(GLYPH_COLORS.slice(0, 3) as GlyphColor[], rand),
    fill: "solid",
    rotation: 0,
    count: 1,
    size: 0.85,
  };

  const grid: (GlyphSpec | null)[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid.push(buildSpec(r, c, varying, constants));
    }
  }
  const correct = grid[8] as GlyphSpec; // bottom-right
  grid[8] = null;

  const options: GlyphSpec[] = [correct];
  let guard = 0;
  while (options.length < 4 && guard++ < 50) {
    const d = perturb(correct, proximity, rand);
    if (!options.some((o) => specsEqual(o, d))) options.push(d);
  }
  while (options.length < 4) options.push(perturb(correct, 0, rand));

  // shuffle options, track correct index
  const shuffled = options
    .map((spec) => ({ spec, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.spec);
  const correct_index = shuffled.findIndex((s) => specsEqual(s, correct));

  return {
    grid,
    options: shuffled,
    correct_index,
    rule_depth: depth,
    distractor_proximity: proximity,
  };
}
