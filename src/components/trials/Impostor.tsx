// impostor (BUILD PROMPT Section 6.2) — dimension: inhibition
// Sprites pop; smash targets, withhold on near-identical impostors. Near-miss
// slow-mo when you flinch fast (<80ms) at an impostor but don't commit.
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sfx";
import { median, round } from "@/lib/engine/metrics";
import {
  initStaircase,
  levelLerp,
  stepStaircase,
  type StaircaseConfig,
  type StaircaseState,
} from "@/lib/engine/staircase";
import type { TrialComponentProps } from "@/lib/engine/types";

const DURATION_MS = 40_000;
const CFG: StaircaseConfig = { min: 0, max: 3, start: 1, down: 2, up: 1 };
const NEAR_MISS_WINDOW = 80;

interface SpriteSpec {
  hue: number;
  eyes: 2 | 3;
  spots: number;
  horns: boolean;
  mouth: "flat" | "smile" | "oh";
}

interface Live {
  id: number;
  spec: SpriteSpec;
  isImpostor: boolean;
  spawnT: number;
  ttl: number;
  resolved: boolean;
}

function baseSprite(): SpriteSpec {
  return { hue: 190, eyes: 2, spots: 1, horns: false, mouth: "flat" };
}

// Similarity tier 0..3 → 88/91/94/96%: higher tier = subtler impostor.
function makeImpostor(base: SpriteSpec, tier: number): SpriteSpec {
  const s = { ...base };
  if (tier <= 0) s.horns = !s.horns;
  else if (tier === 1) s.eyes = s.eyes === 2 ? 3 : 2;
  else if (tier === 2) s.mouth = s.mouth === "flat" ? "smile" : "flat";
  else s.spots = s.spots + 1; // subtlest: one extra spot
  return s;
}

function Sprite({ spec, size = 120 }: { spec: SpriteSpec; size?: number }) {
  const fill = `hsl(${spec.hue} 60% 55%)`;
  const dark = `hsl(${spec.hue} 55% 32%)`;
  const eyeX = spec.eyes === 3 ? [38, 60, 82] : [44, 76];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
      <path d="M60 12 C92 12 104 40 100 70 C96 100 78 108 60 108 C42 108 24 100 20 70 C16 40 28 12 60 12Z" fill={fill} stroke={dark} strokeWidth={3} />
      {spec.horns ? (
        <>
          <path d="M34 20 L26 4 L44 16Z" fill={dark} />
          <path d="M86 20 L94 4 L76 16Z" fill={dark} />
        </>
      ) : null}
      {eyeX.map((x) => (
        <circle key={x} cx={x} cy={54} r={7} fill="#0a1020" />
      ))}
      {Array.from({ length: spec.spots }).map((_, i) => (
        <circle key={i} cx={40 + i * 20} cy={86} r={4} fill={dark} />
      ))}
      {spec.mouth === "flat" && <rect x={48} y={80} width={24} height={3} rx={1.5} fill="#0a1020" />}
      {spec.mouth === "smile" && <path d="M46 78 Q60 92 74 78" fill="none" stroke="#0a1020" strokeWidth={3} strokeLinecap="round" />}
      {spec.mouth === "oh" && <circle cx={60} cy={82} r={6} fill="#0a1020" />}
    </svg>
  );
}

export function Impostor({ chaos, difficulty, onComplete }: TrialComponentProps) {
  const [live, setLive] = useState<Live | null>(null);
  const [slowmo, setSlowmo] = useState(false);
  const ref = baseSprite();

  const stair = useRef<StaircaseState>(
    initStaircase(CFG, (difficulty as { staircase?: StaircaseState }).staircase)
  );
  const startT = useRef(0);
  const nextId = useRef(1);
  const goRTs = useRef<number[]>([]);
  const stats = useRef({ hits: 0, misses: 0, commissions: 0, impostors: 0, nearMisses: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downT = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    startT.current = performance.now();
    spawn();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function params() {
    const lvl = stair.current.level;
    return {
      tier: lvl,
      impostorRate: levelLerp(lvl, CFG, 0.1, 0.35),
      ttl: Math.round(levelLerp(lvl, CFG, 1100, 650)),
    };
  }

  function spawn() {
    const elapsed = performance.now() - startT.current;
    if (elapsed >= DURATION_MS) return finish();
    const p = params();
    const isImpostor = Math.random() < p.impostorRate;
    if (isImpostor) stats.current.impostors++;
    const item: Live = {
      id: nextId.current++,
      spec: isImpostor ? makeImpostor(ref, p.tier) : { ...ref },
      isImpostor,
      spawnT: elapsed,
      ttl: p.ttl,
      resolved: false,
    };
    setLive(item);
    timer.current = setTimeout(() => expire(item), p.ttl);
  }

  function expire(item: Live) {
    if (item.resolved) return;
    item.resolved = true;
    if (item.isImpostor) {
      // correct rejection
      stair.current = stepStaircase(stair.current, CFG, true);
    } else {
      // missed a target
      stats.current.misses++;
      stair.current = stepStaircase(stair.current, CFG, false);
    }
    setLive(null);
    setTimeout(spawn, 220);
  }

  function onDown() {
    downT.current = performance.now();
  }

  function onUp(item: Live) {
    if (item.resolved) return;
    const now = performance.now();
    const rt = now - startT.current - item.spawnT;

    if (!item.isImpostor) {
      item.resolved = true;
      stats.current.hits++;
      goRTs.current.push(rt);
      sfx("tap");
      stair.current = stepStaircase(stair.current, CFG, true);
      settle(item);
      return;
    }

    // Impostor tapped. A very fast flinch (<80ms) reads as a caught near-miss.
    if (rt < NEAR_MISS_WINDOW) {
      item.resolved = true;
      stats.current.nearMisses++;
      setSlowmo(true);
      sfx("glitch");
      setTimeout(() => setSlowmo(false), 300);
      stair.current = stepStaircase(stair.current, CFG, true);
      settle(item);
      return;
    }

    // Committed on an impostor = commission error.
    item.resolved = true;
    stats.current.commissions++;
    sfx("shatter");
    stair.current = stepStaircase(stair.current, CFG, false);
    settle(item);
  }

  function settle(item: Live) {
    if (timer.current) clearTimeout(timer.current);
    setLive(null);
    setTimeout(spawn, 220);
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    const s = stats.current;
    const commissionRate = s.impostors ? s.commissions / s.impostors : 0;
    onComplete({
      events: [],
      summary: {
        commission_error_rate: round(commissionRate, 2),
        go_median_rt: round(median(goRTs.current)),
        hits: s.hits,
        near_misses: s.nearMisses,
      },
      difficultyState: { staircase: stair.current },
      coreMetricValue: round(commissionRate, 3), // lower is better
    });
  }

  return (
    <div className="screen center" style={{ transition: slowmo ? "all 0.3s" : undefined }}>
      <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
        <span className="kicker">{chaos ? "SMASH THE IMPOSTORS" : "Smash the real one"}</span>
      </div>
      <div className="grow" style={{ display: "grid", placeItems: "center", width: "100%" }}>
        <div className="center">
          <p className="faint" style={{ fontSize: 12, marginBottom: 8 }}>reference</p>
          <div style={{ opacity: 0.6, marginBottom: 24 }}>
            <Sprite spec={ref} size={70} />
          </div>
          <div
            style={{
              minHeight: 160,
              display: "grid",
              placeItems: "center",
              filter: slowmo ? "hue-rotate(30deg) saturate(1.5)" : undefined,
              transform: slowmo ? "scale(1.1)" : "scale(1)",
              transition: "transform 0.3s ease",
            }}
          >
            {live ? (
              <button
                onPointerDown={onDown}
                onPointerUp={() => onUp(live)}
                style={{ background: "transparent", padding: 8 }}
                aria-label="sprite"
              >
                <Sprite spec={live.spec} size={140} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
