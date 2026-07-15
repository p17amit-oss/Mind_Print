// Reusable glyph composer built on the existing glyph primitives (Glyph + types).
// Compose a GlyphSpec visually (shape × count × fill × rotation × color × size).
import { Glyph } from "@/lib/glyphs/Glyph";
import {
  GLYPH_COLORS,
  GLYPH_FILLS,
  GLYPH_SHAPES,
  type GlyphSpec,
} from "@/lib/glyphs/types";

export function GlyphPicker({
  value,
  onChange,
  size = 120,
}: {
  value: GlyphSpec;
  onChange: (spec: GlyphSpec) => void;
  size?: number;
}) {
  const set = (patch: Partial<GlyphSpec>) => onChange({ ...value, ...patch });
  return (
    <div>
      <div className="card center" style={{ display: "grid", placeItems: "center", padding: 16, marginBottom: 12 }}>
        <Glyph spec={value} size={size} />
      </div>
      <Row label="shape">
        <Chips items={GLYPH_SHAPES} value={value.shape} onPick={(v) => set({ shape: v })} />
      </Row>
      <Row label="fill">
        <Chips items={GLYPH_FILLS} value={value.fill} onPick={(v) => set({ fill: v })} />
      </Row>
      <Row label="color">
        <Chips items={GLYPH_COLORS} value={value.color} onPick={(v) => set({ color: v })} />
      </Row>
      <Row label={`count · ${value.count}`}>
        <input type="range" min={1} max={4} value={value.count} onChange={(e) => set({ count: +e.target.value })} style={{ width: "100%" }} />
      </Row>
      <Row label={`size · ${value.size.toFixed(2)}`}>
        <input type="range" min={0.4} max={1} step={0.05} value={value.size} onChange={(e) => set({ size: +e.target.value })} style={{ width: "100%" }} />
      </Row>
      <Row label={`rotation · ${value.rotation}°`}>
        <input type="range" min={0} max={315} step={45} value={value.rotation} onChange={(e) => set({ rotation: +e.target.value })} style={{ width: "100%" }} />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p className="faint num" style={{ fontSize: 11, marginBottom: 4 }}>{label}</p>
      {children}
    </div>
  );
}

function Chips<T extends string>({ items, value, onPick }: { items: readonly T[]; value: T; onPick: (v: T) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {items.map((it) => (
        <button
          key={it}
          onClick={() => onPick(it)}
          className="btn"
          style={{
            minHeight: 30,
            padding: "4px 10px",
            fontSize: 12,
            background: it === value ? "var(--panel-2)" : "transparent",
            border: `1px solid ${it === value ? "var(--whiteblue)" : "var(--line)"}`,
          }}
        >
          {it}
        </button>
      ))}
    </div>
  );
}
