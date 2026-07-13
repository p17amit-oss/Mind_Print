// fooled (BUILD PROMPT Section 6.6) — dimension: detection. The world-clock trial.
// Call REAL (human) or FAKE (AI). Instant verdict flash + provenance chip.
// Momentum meter: consecutive correct calls build a cosmetic "sense" streak.
// NOTE: the server-only `fooled_call {tier,modality,correct}` event is emitted by
// /api/run (server-side, no PII) — never from the client.
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/client/sfx";
import { dPrime, median, round } from "@/lib/engine/metrics";
import { buildFooledRun, provenanceChip, type FooledItem } from "@/lib/trials/fooledbank";
import type { TrialComponentProps, TrialEventLog } from "@/lib/engine/types";

export function Fooled({ items, onComplete }: TrialComponentProps) {
  const run = useMemo<FooledItem[]>(
    () => ((items as FooledItem[])?.length ? (items as FooledItem[]) : buildFooledRun()),
    [items]
  );
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<{ correct: boolean; chip: string } | null>(null);
  const shownAt = useRef(performance.now());
  const events = useRef<TrialEventLog[]>([]);
  const stats = useRef({ hits: 0, fakes: 0, falseAlarms: 0, reals: 0, correct: 0 });
  const rts = useRef<number[]>([]);
  const byModality = useRef<Record<string, { c: number; n: number }>>({});
  const byTier = useRef<Record<string, { c: number; n: number }>>({});
  const finished = useRef(false);

  const item = run[idx];

  function call(saidFake: boolean) {
    if (flash) return;
    const rt = performance.now() - shownAt.current;
    rts.current.push(rt);
    const correct = saidFake === item.isFake;

    if (item.isFake) {
      stats.current.fakes++;
      if (saidFake) stats.current.hits++;
    } else {
      stats.current.reals++;
      if (saidFake) stats.current.falseAlarms++;
    }
    if (correct) stats.current.correct++;

    const bm = (byModality.current[item.modality] ??= { c: 0, n: 0 });
    bm.n++;
    if (correct) bm.c++;
    const bt = (byTier.current[`t${item.tier}`] ??= { c: 0, n: 0 });
    bt.n++;
    if (correct) bt.c++;

    events.current.push({
      seq: idx,
      item_ref: item.item_id,
      stimulus: { modality: item.modality, tier: item.tier },
      response: { call: saidFake ? "fake" : "real" },
      rt_ms: Math.round(rt),
      correct,
    });

    sfx(correct ? "chime" : "glitch");
    setStreak((s) => (correct ? s + 1 : 0));
    setFlash({ correct, chip: provenanceChip(item) });

    setTimeout(() => {
      setFlash(null);
      if (idx + 1 >= run.length) return finish();
      setIdx((i) => i + 1);
      shownAt.current = performance.now();
    }, 900);
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    const s = stats.current;
    const acc = run.length ? s.correct / run.length : 0;
    const dp = round(dPrime(s.hits, s.fakes, s.falseAlarms, s.reals), 2);
    const byMod: Record<string, number> = {};
    for (const k in byModality.current) byMod[`mod_${k}`] = round((byModality.current[k].c / byModality.current[k].n) * 100);
    const byT: Record<string, number> = {};
    for (const k in byTier.current) byT[`tier_${k}`] = round((byTier.current[k].c / byTier.current[k].n) * 100);
    onComplete({
      events: events.current,
      summary: {
        detection_accuracy: round(acc * 100),
        d_prime_detection: dp,
        median_call_rt: round(median(rts.current)),
        caught: s.hits,
        fakes: s.fakes,
        ...byMod,
        ...byT,
      },
      difficultyState: {},
      coreMetricValue: round(acc * 100), // higher is better
    });
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="kicker">Real, or made? · {idx + 1}/{run.length}</span>
        <span className="num" style={{ color: "var(--teal)" }}>
          {streak > 1 ? `sense ×${streak}` : ""}
        </span>
      </div>

      <div className="grow" style={{ display: "grid", placeItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          {item.modality === "text" ? (
            <div className="card" style={{ fontSize: 18, lineHeight: 1.55, minHeight: 160 }}>
              {item.text}
            </div>
          ) : (
            <PlaceholderImage seed={item.imageSeed ?? 1} />
          )}

          {flash ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="num center"
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                background: flash.correct ? "rgba(53,214,195,0.15)" : "rgba(255,77,94,0.15)",
                border: `1px solid ${flash.correct ? "var(--teal)" : "var(--signal-red)"}`,
                color: flash.correct ? "var(--teal)" : "var(--warm-white)",
              }}
            >
              {flash.correct ? "✓ " : "✗ "}
              {flash.chip}
            </motion.div>
          ) : null}
        </div>
      </div>

      <div className="row" style={{ gap: 12 }}>
        <button
          className="btn grow"
          style={{ background: "var(--warm-white)", color: "#241a02", fontWeight: 700 }}
          disabled={!!flash}
          onClick={() => call(false)}
        >
          REAL
        </button>
        <button
          className="btn grow"
          style={{ background: "var(--signal-red)", color: "#2a0308", fontWeight: 700 }}
          disabled={!!flash}
          onClick={() => call(true)}
        >
          FAKE
        </button>
      </div>
    </div>
  );
}

// Abstract SVG placeholder for image items (dev only). Production serves real
// rights-clean images from the item bank; the mechanic is identical.
function PlaceholderImage({ seed }: { seed: number }) {
  const hue = (seed * 47) % 360;
  return (
    <svg viewBox="0 0 360 220" width="100%" height={220} style={{ borderRadius: 12, display: "block" }}>
      <defs>
        <linearGradient id={`g${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 50% 30%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 60) % 360} 50% 18%)`} />
        </linearGradient>
      </defs>
      <rect width="360" height="220" fill={`url(#g${seed})`} />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle
          key={i}
          cx={(seed * (i + 3) * 37) % 360}
          cy={(seed * (i + 1) * 53) % 220}
          r={12 + ((seed * (i + 2)) % 40)}
          fill={`hsl(${(hue + i * 30) % 360} 60% 55%)`}
          opacity={0.35}
        />
      ))}
    </svg>
  );
}
