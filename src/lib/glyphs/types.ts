// Composable glyph specification for alien_rules (BUILD PROMPT Section 6.4).
// Glyphs are pure data → rendered as SVG client-side. Matrix rules operate over
// these orthogonal features (shape, count, size, rotation, fill, color), which is
// what makes rule induction well-formed.

export const GLYPH_SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "hexagon",
  "star",
  "ring",
] as const;
export type GlyphShape = (typeof GLYPH_SHAPES)[number];

export const GLYPH_FILLS = ["none", "solid", "half", "dots", "lines"] as const;
export type GlyphFill = (typeof GLYPH_FILLS)[number];

// Palette keys map to design tokens (Section 12), resolved in the renderer.
export const GLYPH_COLORS = ["whiteblue", "teal", "gold", "red", "warm", "violet"] as const;
export type GlyphColor = (typeof GLYPH_COLORS)[number];

export interface GlyphSpec {
  shape: GlyphShape;
  /** 1–4 repeated marks, arranged in a tidy micro-layout. */
  count: number;
  /** 0.4–1.0 relative scale. */
  size: number;
  /** degrees */
  rotation: number;
  fill: GlyphFill;
  color: GlyphColor;
}

export const DEFAULT_GLYPH: GlyphSpec = {
  shape: "circle",
  count: 1,
  size: 0.8,
  rotation: 0,
  fill: "solid",
  color: "whiteblue",
};

/** An alien_rules item (content JSON, Section 6.4). */
export interface AlienItem {
  grid: (GlyphSpec | null)[]; // 8 filled + 1 null (the missing cell)
  options: GlyphSpec[]; // 4 candidates
  correct_index: number;
  rule_depth: 1 | 2 | 3;
  distractor_proximity: 0 | 1 | 2;
}
