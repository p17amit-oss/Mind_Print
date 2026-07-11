// /dev/glyphs — glyph renderer playground (BUILD PROMPT Section 6.4 / build step 2).
import { useState } from "react";
import { Glyph } from "@/lib/glyphs/Glyph";
import {
  DEFAULT_GLYPH,
  GLYPH_COLORS,
  GLYPH_FILLS,
  GLYPH_SHAPES,
  type GlyphSpec,
} from "@/lib/glyphs/types";

export default function GlyphsDev() {
  const [spec, setSpec] = useState<GlyphSpec>({ ...DEFAULT_GLYPH });
  const set = (patch: Partial<GlyphSpec>) => setSpec((s) => ({ ...s, ...patch }));

  return (
    <div style={{ padding: 20, maxWidth: 480, margin: "0 auto" }}>
      <p className="kicker">Dev · Glyphs</p>
      <h1 style={{ fontSize: 24, margin: "8px 0 20px" }}>Glyph renderer</h1>

      <div
        className="card center"
        style={{ display: "grid", placeItems: "center", padding: 28, marginBottom: 20 }}
      >
        <Glyph spec={spec} size={160} />
      </div>

      <Control label={`shape · ${spec.shape}`}>
        <Chips items={GLYPH_SHAPES} value={spec.shape} onPick={(v) => set({ shape: v })} />
      </Control>
      <Control label={`fill · ${spec.fill}`}>
        <Chips items={GLYPH_FILLS} value={spec.fill} onPick={(v) => set({ fill: v })} />
      </Control>
      <Control label={`color · ${spec.color}`}>
        <Chips items={GLYPH_COLORS} value={spec.color} onPick={(v) => set({ color: v })} />
      </Control>
      <Control label={`count · ${spec.count}`}>
        <input
          type="range"
          min={1}
          max={4}
          value={spec.count}
          onChange={(e) => set({ count: +e.target.value })}
          style={{ width: "100%" }}
        />
      </Control>
      <Control label={`size · ${spec.size.toFixed(2)}`}>
        <input
          type="range"
          min={0.4}
          max={1}
          step={0.05}
          value={spec.size}
          onChange={(e) => set({ size: +e.target.value })}
          style={{ width: "100%" }}
        />
      </Control>
      <Control label={`rotation · ${spec.rotation}°`}>
        <input
          type="range"
          min={0}
          max={315}
          step={45}
          value={spec.rotation}
          onChange={(e) => set({ rotation: +e.target.value })}
          style={{ width: "100%" }}
        />
      </Control>

      <h2 style={{ fontSize: 16, margin: "28px 0 12px" }} className="dim">
        All shapes
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {GLYPH_SHAPES.map((shape) =>
          GLYPH_COLORS.slice(0, 4).map((color) => (
            <div key={`${shape}-${color}`} className="card" style={{ padding: 8, display: "grid", placeItems: "center" }}>
              <Glyph spec={{ ...DEFAULT_GLYPH, shape, color }} size={56} />
            </div>
          ))
        )}
      </div>

      <pre
        className="num"
        style={{
          marginTop: 24,
          padding: 12,
          background: "var(--field-2)",
          borderRadius: 10,
          fontSize: 12,
          overflowX: "auto",
        }}
      >
        {JSON.stringify(spec, null, 2)}
      </pre>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p className="faint num" style={{ fontSize: 12, marginBottom: 6 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function Chips<T extends string>({
  items,
  value,
  onPick,
}: {
  items: readonly T[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => (
        <button
          key={it}
          onClick={() => onPick(it)}
          className="btn"
          style={{
            minHeight: 36,
            padding: "6px 12px",
            fontSize: 13,
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
