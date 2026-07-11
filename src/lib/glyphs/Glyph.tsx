// Glyph renderer — composable SVG primitives (BUILD PROMPT Section 6.4).
// Make it beautiful: clean geometry, one accent per glyph, soft glow.
import { useId } from "react";
import type { GlyphColor, GlyphFill, GlyphShape, GlyphSpec } from "./types";

const COLOR_HEX: Record<GlyphColor, string> = {
  whiteblue: "#bcd4ff",
  teal: "#35d6c3",
  gold: "#f5c451",
  red: "#ff4d5e",
  warm: "#fff3df",
  violet: "#b28dff",
};

// Layout offsets (in a 100×100 cell) for 1–4 marks.
const LAYOUTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[32, 50], [68, 50]],
  3: [[50, 34], [33, 66], [67, 66]],
  4: [[34, 34], [66, 34], [34, 66], [66, 66]],
};

function shapePath(shape: GlyphShape, cx: number, cy: number, r: number): string {
  const pts = (n: number, rot = -90) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((rot + (360 / n) * i) * Math.PI) / 180;
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  switch (shape) {
    case "square":
      return `M${cx - r},${cy - r} h${2 * r} v${2 * r} h${-2 * r} Z`;
    case "triangle":
      return `M ${pts(3)} Z`;
    case "diamond":
      return `M ${pts(4)} Z`;
    case "hexagon":
      return `M ${pts(6)} Z`;
    case "star": {
      const p = Array.from({ length: 10 }, (_, i) => {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = ((-90 + 36 * i) * Math.PI) / 180;
        return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
      }).join(" ");
      return `M ${p} Z`;
    }
    case "ring":
    case "circle":
    default:
      // circle handled with <circle>, but return a path fallback
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0`;
  }
}

export function Glyph({
  spec,
  size = 88,
  glow = true,
}: {
  spec: GlyphSpec;
  size?: number;
  glow?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const color = COLOR_HEX[spec.color] ?? COLOR_HEX.whiteblue;
  const marks = LAYOUTS[Math.min(4, Math.max(1, spec.count))] ?? LAYOUTS[1];
  const baseR = spec.count === 1 ? 34 : 18;
  const r = baseR * spec.size;

  const fillDef = fillFor(spec.fill, color, uid);

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden>
      <defs>
        {fillDef.def}
        {glow ? (
          <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.1" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ) : null}
      </defs>
      <g filter={glow ? `url(#glow-${uid})` : undefined}>
        {marks.map(([cx, cy], i) => {
          const common = {
            fill: fillDef.fill,
            stroke: color,
            strokeWidth: 3,
            strokeLinejoin: "round" as const,
            transform: `rotate(${spec.rotation} ${cx} ${cy})`,
          };
          if (spec.shape === "circle") {
            return <circle key={i} cx={cx} cy={cy} r={r} {...common} />;
          }
          if (spec.shape === "ring") {
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={r * 0.42}
              />
            );
          }
          return <path key={i} d={shapePath(spec.shape, cx, cy, r)} {...common} />;
        })}
      </g>
    </svg>
  );
}

function fillFor(
  fill: GlyphFill,
  color: string,
  uid: string
): { fill: string; def: JSX.Element | null } {
  switch (fill) {
    case "none":
      return { fill: "none", def: null };
    case "solid":
      return { fill: color, def: null };
    case "half":
      return {
        fill: `url(#half-${uid})`,
        def: (
          <linearGradient id={`half-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="50%" stopColor={color} />
            <stop offset="50%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        ),
      };
    case "dots":
      return {
        fill: `url(#dots-${uid})`,
        def: (
          <pattern id={`dots-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill={color} />
          </pattern>
        ),
      };
    case "lines":
      return {
        fill: `url(#lines-${uid})`,
        def: (
          <pattern
            id={`lines-${uid}`}
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="3" height="7" fill={color} />
          </pattern>
        ),
      };
    default:
      return { fill: color, def: null };
  }
}
