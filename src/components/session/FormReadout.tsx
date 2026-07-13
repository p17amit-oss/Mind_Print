// Form readout (BUILD PROMPT Section 8). Athlete's vocabulary only — a bad day
// is form, not fate. NEVER clinical/trait/health language (enforced by the
// compliance grep over Form copy).
import { motion } from "framer-motion";
import { DIMENSION_META, type DisplayDimension } from "@/lib/dimensions";
import { track } from "@/lib/client/track";
import { useEffect } from "react";

export interface FormChipData {
  dimension: DisplayDimension;
  form_z: number | null;
  baseline_n: number;
  scaled: number | null;
}

function line(dim: DisplayDimension, scaled: number): string {
  const label = DIMENSION_META[dim].label;
  const mag = Math.abs(scaled);
  if (scaled >= 0) {
    if (mag >= 12) return `${label} — sharp today.`;
    if (mag >= 5) return `${label} — a step up.`;
    return `${label} — steady.`;
  }
  if (mag >= 12) return `${label} — foggy today. Form, not fate.`;
  if (mag >= 5) return `${label} — off your usual.`;
  return `${label} — steady.`;
}

export function FormReadout({
  chips,
  onNext,
}: {
  chips: FormChipData[];
  onNext: () => void;
}) {
  useEffect(() => {
    for (const c of chips) {
      if (c.scaled != null) track("form_viewed", { dimension: c.dimension, form: c.scaled });
    }
  }, [chips]);

  return (
    <div className="screen">
      <div className="grow" />
      <p className="kicker center">Today&apos;s form</p>
      <h1 className="center" style={{ fontSize: 24, margin: "8px 0 24px" }}>How you moved</h1>
      <div className="stack" style={{ gap: 12 }}>
        {chips.map((c, i) => (
          <motion.div
            key={c.dimension}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.12 }}
            className="card row"
            style={{ justifyContent: "space-between", padding: "14px 16px" }}
          >
            {c.scaled == null ? (
              <>
                <span>{DIMENSION_META[c.dimension].label}</span>
                <span className="num faint" style={{ fontSize: 13 }}>
                  Baseline building — {Math.max(0, 5 - c.baseline_n)} more
                </span>
              </>
            ) : (
              <>
                <span>{line(c.dimension, c.scaled)}</span>
                <span
                  className="num"
                  style={{ fontSize: 20, color: c.scaled >= 0 ? "var(--teal)" : "var(--gold)" }}
                >
                  {c.scaled >= 0 ? "+" : ""}
                  {c.scaled}
                </span>
              </>
            )}
          </motion.div>
        ))}
      </div>
      <div className="grow" />
      <button className="btn btn-primary" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}
