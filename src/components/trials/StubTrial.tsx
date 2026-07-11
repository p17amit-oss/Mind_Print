// Stub trial for the engine shell (build step 3). A real reaction tap so the
// wager→trial→resolution loop is exercisable before the six trials land.
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sfx";
import type { TrialComponentProps } from "@/lib/engine/types";

export function StubTrial({ onComplete }: TrialComponentProps) {
  const [active, setActive] = useState(false);
  const [round, setRound] = useState(0);
  const shownAt = useRef(0);
  const rts = useRef<number[]>([]);
  const TOTAL = 5;

  useEffect(() => {
    const delay = 600 + Math.random() * 1400;
    const id = setTimeout(() => {
      setActive(true);
      shownAt.current = Date.now();
    }, delay);
    return () => clearTimeout(id);
  }, [round]);

  function tap() {
    if (!active) return;
    const rt = Date.now() - shownAt.current;
    rts.current.push(rt);
    sfx("tap");
    setActive(false);
    if (round + 1 >= TOTAL) finish();
    else setRound((r) => r + 1);
  }

  function finish() {
    const arr = rts.current;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    onComplete({
      events: arr.map((rt, i) => ({ seq: i, rt_ms: rt, correct: true })),
      summary: { median_rt: mean, rounds: arr.length },
      difficultyState: {},
      coreMetricValue: mean,
    });
  }

  return (
    <div className="screen center" onClick={tap} style={{ userSelect: "none" }}>
      <div className="grow" />
      <p className="kicker">Stub · tap when it lights</p>
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          margin: "24px auto",
          background: active ? "var(--teal)" : "var(--panel)",
          boxShadow: active ? "0 0 40px var(--teal)" : "none",
          transition: "background 0.05s, box-shadow 0.05s",
        }}
      />
      <p className="num dim">{round + 1} / 5</p>
      <div className="grow" />
    </div>
  );
}
