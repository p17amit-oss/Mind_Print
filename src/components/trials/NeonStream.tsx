// neon_stream (BUILD PROMPT Section 6.1) — dimension: speed (+flexibility in chaos)
// Words drift up a single lane; tap real words, let fakes pass. Combo ×1.5 per 5,
// breaks on error with a shatter. Staircase: interval 1200→400, fake_tier 1→3.
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sfx";
import { makeFake, makeReal } from "@/lib/trials/wordbank";
import { dPrime, median, round } from "@/lib/engine/metrics";
import {
  initStaircase,
  stepStaircase,
  type StaircaseConfig,
  type StaircaseState,
} from "@/lib/engine/staircase";
import type { TrialComponentProps } from "@/lib/engine/types";

const DURATION_MS = 45_000;
const TRAVEL_MS = 2600; // bottom → top
const CFG: StaircaseConfig = { min: 0, max: 8, start: 3, down: 2, up: 1 };

interface Word {
  id: number;
  text: string;
  isReal: boolean;
  tier: 1 | 2 | 3;
  spawnT: number;
  resolved: boolean;
  tapT?: number;
}

function levelParams(level: number) {
  return {
    interval: 1200 - level * 100, // 1200 → 400
    tier: (Math.min(3, 1 + Math.floor(level / 3)) as 1 | 2 | 3),
  };
}

export function NeonStream({ chaos, difficulty, onComplete }: TrialComponentProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [combo, setCombo] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [freeze, setFreeze] = useState(false);

  const stair = useRef<StaircaseState>(
    initStaircase(CFG, (difficulty as { staircase?: StaircaseState }).staircase)
  );
  const startT = useRef(0);
  const lastSpawn = useRef(0);
  const nextId = useRef(1);
  const peakCombo = useRef(0);
  const flipT = useRef<number | null>(null);
  const freezeRef = useRef(false);
  const flippedRef = useRef(false);
  const comboRef = useRef(0);
  const results = useRef({ hits: 0, misses: 0, falseAlarms: 0, correctRej: 0, signals: 0, noise: 0 });
  const hitRTs = useRef<number[]>([]);
  const flipRTs = useRef<{ before: number[]; after: number[] }>({ before: [], after: [] });
  const raf = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    startT.current = performance.now();
    const chaosFlipAt = DURATION_MS * 0.5;

    const loop = (now: number) => {
      const elapsed = now - startT.current;

      // Chaos freeze + rule flip at the midpoint.
      if (chaos && !flippedRef.current && elapsed >= chaosFlipAt) {
        freezeRef.current = true;
        flippedRef.current = true;
        setFreeze(true);
        setFlipped(true);
        flipT.current = elapsed;
        sfx("glitch");
        setTimeout(() => {
          freezeRef.current = false;
          setFreeze(false);
        }, 800);
      }

      // Spawn.
      const { interval, tier } = levelParams(stair.current.level);
      if (!freezeRef.current && elapsed - lastSpawn.current >= interval && elapsed < DURATION_MS - TRAVEL_MS) {
        lastSpawn.current = elapsed;
        const isReal = Math.random() < 0.55;
        setWords((ws) => [
          ...ws,
          {
            id: nextId.current++,
            text: isReal ? makeReal() : makeFake(tier),
            isReal,
            tier,
            spawnT: elapsed,
            resolved: false,
          },
        ]);
      }

      // Resolve words that scrolled off the top (no tap).
      setWords((ws) => {
        const keep: Word[] = [];
        for (const w of ws) {
          if (!w.resolved && elapsed - w.spawnT > TRAVEL_MS) {
            resolvePassed(w);
          } else {
            keep.push(w);
          }
        }
        return keep;
      });

      if (elapsed >= DURATION_MS) {
        finish();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A word that drifted off untapped. Correct action = ignore fakes (or reals when flipped).
  function resolvePassed(w: Word) {
    if (w.resolved) return; // idempotent (React strict-mode re-invokes updaters)
    w.resolved = true;
    const target = flippedRef.current ? !w.isReal : w.isReal; // "should-tap" word?
    if (w.isReal) results.current.signals++;
    else results.current.noise++;
    if (target) results.current.misses++;
    else results.current.correctRej++;
  }

  function tap(w: Word) {
    if (w.resolved || freezeRef.current) return;
    w.resolved = true;
    const rt = (performance.now() - startT.current) - w.spawnT;
    const shouldTap = flippedRef.current ? !w.isReal : w.isReal;

    if (w.isReal) results.current.signals++;
    else results.current.noise++;

    if (shouldTap) {
      // hit
      results.current.hits++;
      hitRTs.current.push(rt);
      recordFlipRT(rt);
      const c = comboRef.current + 1;
      comboRef.current = c;
      setCombo(c);
      peakCombo.current = Math.max(peakCombo.current, c);
      sfx(c % 5 === 0 ? "combo" : "tap");
      stair.current = stepStaircase(stair.current, CFG, true);
    } else {
      // false alarm — combo shatters
      results.current.falseAlarms++;
      comboRef.current = 0;
      setCombo(0);
      sfx("shatter");
      stair.current = stepStaircase(stair.current, CFG, false);
    }
    setWords((ws) => ws.filter((x) => x.id !== w.id));
  }

  function recordFlipRT(rt: number) {
    if (flipT.current == null) flipRTs.current.before.push(rt);
    else if (flipRTs.current.after.length < 3) flipRTs.current.after.push(rt);
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    cancelAnimationFrame(raf.current);
    const r = results.current;
    const medRT = round(median(hitRTs.current));
    const hitRate = r.signals ? r.hits / r.signals : 0;
    const far = r.noise ? r.falseAlarms / r.noise : 0;
    const dp = round(dPrime(r.hits, r.signals, r.falseAlarms, r.noise), 2);
    const before = median(flipRTs.current.before.slice(-3));
    const after = median(flipRTs.current.after);
    const switchCost = chaos && after ? round(after - before) : 0;

    onComplete({
      events: [],
      summary: {
        median_hit_rt: medRT,
        best_rt: round(Math.min(...(hitRTs.current.length ? hitRTs.current : [0]))),
        hit_rate: round(hitRate, 2),
        false_alarm_rate: round(far, 2),
        false_alarms: r.falseAlarms,
        d_prime: dp,
        peak_combo: peakCombo.current,
        ...(chaos ? { switch_cost_ms: switchCost } : {}),
      },
      difficultyState: { staircase: stair.current },
      coreMetricValue: medRT || 9999, // lower is better
    });
  }

  const now = typeof performance !== "undefined" ? performance.now() - startT.current : 0;
  const rule = flipped ? "TAP THE FAKES" : "TAP REAL WORDS";

  return (
    <div className="screen" style={{ position: "relative", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="kicker">{rule}</span>
        <span className="num stake">×{(1 + combo * 0.5).toFixed(1)} · {combo}</span>
      </div>

      <div style={{ position: "absolute", inset: 0, top: 60 }}>
        {words.map((w) => {
          const age = now - w.spawnT;
          const y = 1 - Math.min(1, age / TRAVEL_MS); // 1 bottom → 0 top
          return (
            <button
              key={w.id}
              onClick={() => tap(w)}
              className="num"
              style={{
                position: "absolute",
                left: "50%",
                top: `${8 + y * 78}%`,
                transform: "translateX(-50%)",
                background: "transparent",
                color: "var(--whiteblue)",
                fontSize: 26,
                letterSpacing: "0.02em",
                padding: 10,
                textShadow: "0 0 18px rgba(188,212,255,0.5)",
              }}
            >
              {w.text}
            </button>
          );
        })}
      </div>

      {freeze ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,77,94,0.12)",
            backdropFilter: "blur(2px)",
          }}
        >
          <h1 className="fake" style={{ fontSize: 30 }}>TAP THE FAKES</h1>
        </div>
      ) : null}
    </div>
  );
}
