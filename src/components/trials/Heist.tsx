// heist (BUILD PROMPT Section 6.3) — dimension: working_memory
// Code shown 600ms/symbol → hidden → mid-entry mutations flash-change → enter the
// CURRENT code on a 9-symbol keypad. 4 vaults, 1-up perfect / 1-down failed.
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sfx";
import { round } from "@/lib/engine/metrics";
import {
  clamp,
  initStaircase,
  stepStaircase,
  type StaircaseConfig,
  type StaircaseState,
} from "@/lib/engine/staircase";
import type { TrialComponentProps, TrialEventLog } from "@/lib/engine/types";

const KEYPAD = ["△", "○", "□", "◇", "☆", "⬠", "⬡", "▽", "◎"];
const VAULTS = 4;
const CFG: StaircaseConfig = { min: 3, max: 8, start: 3, down: 1, up: 1 };

type Phase = "show" | "entry" | "between" | "done";

export function Heist({ difficulty, onComplete }: TrialComponentProps) {
  const [phase, setPhase] = useState<Phase>("show");
  const [vault, setVault] = useState(0);
  const [revealIdx, setRevealIdx] = useState(0);
  const [entered, setEntered] = useState<number[]>([]);
  const [mutationFlash, setMutationFlash] = useState<{ pos: number; symbol: number } | null>(null);

  const stair = useRef<StaircaseState>(
    initStaircase(CFG, (difficulty as { staircase?: StaircaseState }).staircase)
  );
  const code = useRef<number[]>([]);
  const target = useRef<number[]>([]); // code after mutations
  const mutatedPositions = useRef<number[]>([]);
  const mutationDone = useRef(false);
  const events = useRef<TrialEventLog[]>([]);
  const cleared = useRef<{ span: number; correct: number; total: number }[]>([]);
  const mutTrack = useRef({ correct: 0, total: 0 });
  const finished = useRef(false);

  useEffect(() => {
    startVault(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function vaultParams() {
    const span = stair.current.level;
    const mutations = clamp(Math.floor((span - 3) / 2), 0, 2); // grows with span, 0→2
    const confusability = clamp(1 + Math.floor((span - 3) / 2), 1, 3);
    return { span, mutations, confusability };
  }

  function startVault(v: number) {
    const { span, mutations } = vaultParams();
    const seq = Array.from({ length: span }, () => Math.floor(Math.random() * KEYPAD.length));
    code.current = seq;
    target.current = [...seq];
    mutatedPositions.current = [];
    mutationDone.current = mutations === 0;
    setEntered([]);
    setRevealIdx(0);
    setPhase("show");

    // Reveal each symbol for 600ms.
    let i = 0;
    const tick = () => {
      setRevealIdx(i + 1);
      sfx("tap");
      i++;
      if (i < span) setTimeout(tick, 600);
      else setTimeout(() => setPhase("entry"), 600);
    };
    setTimeout(tick, 400);
  }

  function maybeMutate(nextEnteredLen: number) {
    const { span, mutations } = vaultParams();
    if (mutationDone.current || nextEnteredLen < Math.ceil(span / 2)) return;
    mutationDone.current = true;
    // Mutate `mutations` not-yet-entered positions.
    const remaining = [];
    for (let p = nextEnteredLen; p < span; p++) remaining.push(p);
    const chosen = remaining.sort(() => Math.random() - 0.5).slice(0, mutations);
    for (const pos of chosen) {
      let sym = Math.floor(Math.random() * KEYPAD.length);
      while (sym === target.current[pos]) sym = Math.floor(Math.random() * KEYPAD.length);
      target.current[pos] = sym;
      mutatedPositions.current.push(pos);
      // Flash the change briefly.
      setMutationFlash({ pos, symbol: sym });
      sfx("glitch");
      setTimeout(() => setMutationFlash(null), 300);
    }
    mutTrack.current.total += mutatedPositions.current.length;
  }

  function press(symbol: number) {
    if (phase !== "entry") return;
    const next = [...entered, symbol];
    setEntered(next);
    sfx("tap");
    maybeMutate(next.length);
    if (next.length >= target.current.length) {
      resolveVault(next);
    }
  }

  function resolveVault(next: number[]) {
    const tgt = target.current;
    let correct = 0;
    for (let i = 0; i < tgt.length; i++) if (next[i] === tgt[i]) correct++;
    const perfect = correct === tgt.length;
    const { span, mutations, confusability } = vaultParams();

    // mutation tracking accuracy
    for (const pos of mutatedPositions.current) {
      if (next[pos] === tgt[pos]) mutTrack.current.correct++;
    }
    cleared.current.push({ span, correct, total: tgt.length });
    events.current.push({
      seq: vault,
      item_ref: `heist:span=${span};mut=${mutations};conf=${confusability}`,
      stimulus: { code: code.current, target: tgt },
      response: { entered: next },
      correct: perfect,
    });

    stair.current = stepStaircase(stair.current, CFG, perfect);
    sfx(perfect ? "win" : "loss");

    const nextVault = vault + 1;
    if (nextVault >= VAULTS) return finish();
    setVault(nextVault);
    setPhase("between");
    setTimeout(() => startVault(nextVault), 900);
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    setPhase("done");
    const perfectSpans = cleared.current.filter((c) => c.correct === c.total).map((c) => c.span);
    const maxSpan = perfectSpans.length ? Math.max(...perfectSpans) : 0;
    const atMax = cleared.current.filter((c) => c.span === maxSpan);
    const accAtSpan = atMax.length
      ? atMax.reduce((a, c) => a + c.correct / c.total, 0) / atMax.length
      : 0;
    const mutRate = mutTrack.current.total ? mutTrack.current.correct / mutTrack.current.total : 1;
    onComplete({
      events: events.current,
      summary: {
        max_span_cleared: maxSpan,
        accuracy_at_span: round(accAtSpan * 100),
        mutation_tracking_rate: round(mutRate * 100),
      },
      difficultyState: { staircase: stair.current },
      coreMetricValue: maxSpan, // higher is better
    });
  }

  const span = target.current.length;

  return (
    <div className="screen center">
      <p className="kicker">Vault {Math.min(vault + 1, VAULTS)} / {VAULTS}</p>

      {/* code display slots */}
      <div className="row" style={{ gap: 8, justifyContent: "center", margin: "24px 0", flexWrap: "wrap" }}>
        {Array.from({ length: span }).map((_, i) => {
          const showSymbol = phase === "show" && i < revealIdx;
          const isFlash = mutationFlash?.pos === i;
          return (
            <div
              key={i}
              style={{
                width: 44,
                height: 52,
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                background: isFlash ? "var(--signal-red)" : "var(--panel)",
                border: `1px solid ${i < entered.length ? "var(--teal)" : "var(--line)"}`,
                color: isFlash ? "#0a1020" : "var(--whiteblue)",
                transition: "background 0.1s",
              }}
            >
              {isFlash
                ? KEYPAD[mutationFlash!.symbol]
                : showSymbol
                ? KEYPAD[code.current[i]]
                : i < entered.length
                ? KEYPAD[entered[i]]
                : "·"}
            </div>
          );
        })}
      </div>

      {phase === "show" && <p className="dim">Memorize the code…</p>}
      {phase === "between" && <p className="dim">Vault cracked. Next…</p>}

      <div className="grow" />

      {phase === "entry" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            maxWidth: 300,
            margin: "0 auto",
          }}
        >
          {KEYPAD.map((sym, i) => (
            <button
              key={i}
              className="btn"
              style={{ fontSize: 26, minHeight: 64, background: "var(--panel-2)" }}
              onClick={() => press(i)}
            >
              {sym}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
