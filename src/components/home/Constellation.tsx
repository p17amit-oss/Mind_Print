// The constellation (BUILD PROMPT Section 10). 8 vertices; fog opacity = 1 −
// resolution; ≥90% locks with a pulse. Every screen's job: something hidden
// becoming visible.
import type { DimensionState } from "@/pages/api/state";

export function Constellation({
  dimensions,
  size = 300,
  onTapDimension,
}: {
  dimensions: DimensionState[];
  size?: number;
  onTapDimension?: (d: DimensionState) => void;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const n = dimensions.length || 8;
  const pts = dimensions.map((d, i) => {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180);
    return { d, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ maxWidth: "100%" }}>
      {/* connecting web */}
      {pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        return <line key={`l${i}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--line)" strokeWidth={1} opacity={0.5} />;
      })}
      {pts.map((p, i) => (
        <line key={`s${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--line)" strokeWidth={0.75} opacity={0.3} />
      ))}
      {/* vertices */}
      {pts.map((p, i) => {
        const reso = p.d.resolution;
        const locked = reso >= 0.9;
        const fog = 1 - reso;
        return (
          <g
            key={`v${i}`}
            style={{ cursor: onTapDimension ? "pointer" : "default" }}
            onClick={() => onTapDimension?.(p.d)}
          >
            {/* star */}
            <circle
              cx={p.x}
              cy={p.y}
              r={6 + reso * 5}
              fill="var(--whiteblue)"
              opacity={0.35 + reso * 0.65}
              style={locked ? { animation: "pulse-lock 2.4s ease-in-out infinite" } : undefined}
            />
            {/* fog veil */}
            {fog > 0.02 ? (
              <circle cx={p.x} cy={p.y} r={16} fill="var(--whiteblue)" opacity={fog * 0.28} style={{ filter: "blur(6px)" }} />
            ) : null}
            {/* form pip */}
            {p.d.form_scaled != null ? (
              <circle cx={p.x + 11} cy={p.y - 11} r={3.5} fill={p.d.form_scaled >= 0 ? "var(--teal)" : "var(--gold)"} />
            ) : null}
            <text x={p.x} y={p.y + 26} textAnchor="middle" fontSize={10} fill="var(--text-faint)" className="num">
              {p.d.label}
            </text>
          </g>
        );
      })}
      {/* core */}
      <circle cx={cx} cy={cy} r={4} fill="var(--gold)" opacity={0.8} />
    </svg>
  );
}
