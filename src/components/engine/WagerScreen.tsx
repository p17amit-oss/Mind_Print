// Wager screen (BUILD PROMPT Section 4.3 / 5).
// Three star buttons, last stake pre-selected, 4s auto-confirm.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/client/sfx";
import { STAKE_CONFIDENCE, trialMeta, type TrialType } from "@/lib/trials";
import type { Stake } from "@/lib/engine/wager";

const AUTO_CONFIRM_MS = 4000;

export function WagerScreen({
  trialType,
  chaos,
  lastStake = 2,
  onConfirm,
}: {
  trialType: TrialType;
  chaos: boolean;
  lastStake?: Stake;
  onConfirm: (stake: Stake) => void;
}) {
  const meta = trialMeta(trialType);
  const [stake, setStake] = useState<Stake>(lastStake);
  const [remaining, setRemaining] = useState(AUTO_CONFIRM_MS);
  const done = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const left = AUTO_CONFIRM_MS - (Date.now() - start);
      if (left <= 0) {
        clearInterval(id);
        confirm(stake);
      } else {
        setRemaining(left);
      }
    }, 50);
    return () => clearInterval(id);
    // Intentionally run once; the interval reads latest stake via closure below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stakeRef = useRef(stake);
  stakeRef.current = stake;

  function confirm(s: Stake) {
    if (done.current) return;
    done.current = true;
    sfx("tap");
    onConfirm(s);
  }

  return (
    <div className="screen center">
      <div className="grow" />
      <p className="kicker">{chaos ? "Chaos · " : ""}{meta.title}</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 6px" }}>How sure are you?</h1>
      <p className="dim" style={{ marginBottom: 28 }}>{meta.tagline}</p>

      <div className="row center" style={{ gap: 14, justifyContent: "center", marginBottom: 18 }}>
        {([1, 2, 3] as Stake[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStake(s);
              sfx("tap");
            }}
            aria-label={`Stake ${s}`}
            style={{
              background: "transparent",
              padding: 8,
              transform: s === stake ? "scale(1.12)" : "scale(1)",
              transition: "transform 0.12s ease",
            }}
          >
            <Star filled={s <= stake} />
          </button>
        ))}
      </div>

      <p className="stake num" style={{ fontSize: 15 }}>
        Stake {stake} · {Math.round(STAKE_CONFIDENCE[stake] * 100)}% sure
      </p>

      <div className="grow" />

      <button className="btn btn-gold" onClick={() => confirm(stakeRef.current)}>
        Lock it in
      </button>
      <div style={{ height: 6, marginTop: 12, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: `${(remaining / AUTO_CONFIRM_MS) * 100}%` }}
          transition={{ ease: "linear", duration: 0.05 }}
          style={{ height: "100%", background: "var(--gold)" }}
        />
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
        Auto-locks in {Math.ceil(remaining / 1000)}s
      </p>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width={44} height={44} viewBox="0 0 24 24">
      <path
        d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l7.1-1.01z"
        fill={filled ? "var(--gold)" : "none"}
        stroke="var(--gold)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
