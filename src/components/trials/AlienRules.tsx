// alien_rules (BUILD PROMPT Section 6.4) — dimension: pattern_induction
// 3×3 glyph grid, missing cell, 4 options, ZERO instructions. RT logged, not shown.
// design_difficulty ladder 1,2,2,3 shifted by trailing accuracy. Soft cap 90s.
import { useEffect, useMemo, useRef, useState } from "react";
import { sfx } from "@/lib/client/sfx";
import { round } from "@/lib/engine/metrics";
import { Glyph } from "@/lib/glyphs/Glyph";
import { generateAlienItem } from "@/lib/trials/alien-gen";
import type { AlienItem } from "@/lib/glyphs/types";
import type { TrialComponentProps, TrialEventLog } from "@/lib/engine/types";

const LADDER = [1, 2, 2, 3];
const SOFT_CAP_MS = 90_000;

export function AlienRules({ items, onComplete }: TrialComponentProps) {
  const bank = (items as AlienItem[]) ?? [];
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const shownAt = useRef(0);
  const events = useRef<TrialEventLog[]>([]);
  const results = useRef<{ correct: boolean; ms: number; depth: number }[]>([]);
  const accShift = useRef(0);
  const finished = useRef(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Serve by the difficulty ladder, shifted by trailing accuracy.
  const item: AlienItem = useMemo(() => {
    const base = LADDER[idx] ?? 2;
    const dd = Math.max(1, Math.min(5, base + accShift.current));
    return bank[idx] ?? generateAlienItem(dd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    shownAt.current = performance.now();
    setSelected(null);
    if (capTimer.current) clearTimeout(capTimer.current);
    capTimer.current = setTimeout(() => choose(-1, true), SOFT_CAP_MS);
    return () => {
      if (capTimer.current) clearTimeout(capTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function choose(optionIdx: number, timedOut = false) {
    if (selected !== null || finished.current) return;
    const rt = performance.now() - shownAt.current;
    const correct = !timedOut && optionIdx === item.correct_index;
    setSelected(optionIdx);
    sfx(correct ? "chime" : "glitch");

    results.current.push({ correct, ms: rt, depth: item.rule_depth });
    events.current.push({
      seq: idx,
      item_ref: `alien:d${item.rule_depth}:p${item.distractor_proximity}`,
      response: { chosen: optionIdx, correct_index: item.correct_index },
      rt_ms: Math.round(rt),
      correct,
    });
    // Trailing accuracy shifts the ladder up/down by one step.
    accShift.current = correct ? Math.min(2, accShift.current + 1) : Math.max(-1, accShift.current - 1);

    setTimeout(() => {
      if (idx + 1 >= LADDER.length) finish();
      else setIdx((i) => i + 1);
    }, 650);
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    const r = results.current;
    const acc = r.length ? r.filter((x) => x.correct).length / r.length : 0;
    const meanMs = r.length ? r.reduce((a, x) => a + x.ms, 0) / r.length : 0;
    const byDepth: Record<string, number> = {};
    for (const d of [1, 2, 3]) {
      const sub = r.filter((x) => x.depth === d);
      if (sub.length) byDepth[`depth_${d}`] = round((sub.filter((x) => x.correct).length / sub.length) * 100);
    }
    const bestDepth = Math.max(0, ...r.filter((x) => x.correct).map((x) => x.depth));
    onComplete({
      events: events.current,
      summary: {
        accuracy: round(acc * 100),
        solved: r.filter((x) => x.correct).length,
        mean_solve_ms: round(meanMs),
        best_depth: bestDepth,
        ...byDepth,
      },
      difficultyState: { accShift: accShift.current },
      coreMetricValue: round(acc * 100), // higher is better
    });
  }

  return (
    <div className="screen center">
      <div className="grow" />
      {/* 3×3 matrix */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          background: "var(--line)",
          padding: 6,
          borderRadius: 14,
          maxWidth: 300,
          margin: "0 auto 28px",
        }}
      >
        {item.grid.map((spec, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1",
              background: "var(--field-2)",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
            }}
          >
            {spec ? (
              <Glyph spec={spec} size={72} />
            ) : (
              <span className="faint" style={{ fontSize: 34 }}>
                ?
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 4 options */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          maxWidth: 320,
          margin: "0 auto",
        }}
      >
        {item.options.map((spec, i) => {
          const state =
            selected === null
              ? "idle"
              : i === item.correct_index
              ? "right"
              : i === selected
              ? "wrong"
              : "idle";
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              style={{
                aspectRatio: "1",
                background: "var(--panel)",
                borderRadius: 10,
                border: `2px solid ${
                  state === "right" ? "var(--teal)" : state === "wrong" ? "var(--signal-red)" : "var(--line)"
                }`,
                display: "grid",
                placeItems: "center",
                padding: 4,
              }}
            >
              <Glyph spec={spec} size={54} />
            </button>
          );
        })}
      </div>
      <div className="grow" />
      <p className="faint num" style={{ fontSize: 12 }}>
        {idx + 1} / {LADDER.length}
      </p>
    </div>
  );
}
