// Resolution screen (BUILD PROMPT Section 4.3 / 5).
// Shows wager outcome + one fog/form beat. Losses NEVER show a dead loss —
// always one specific fact from the run. Accurate low bet = teal glint, "You knew."
import { useEffect } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/client/sfx";
import type { ResolutionData } from "@/lib/engine/types";

export function ResolutionScreen({
  data,
  onNext,
}: {
  data: ResolutionData;
  onNext: () => void;
}) {
  useEffect(() => {
    if (data.wager_outcome === "lost") sfx("loss");
    else sfx("win");
  }, [data.wager_outcome]);

  const won = data.wager_outcome === "won" || data.wager_outcome === "baseline_building";
  const glint = data.glint;

  return (
    <div className="screen center">
      <div className="grow" />
      <motion.div
        className="rise"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <p className="kicker">
          {data.wager_outcome === "baseline_building"
            ? "Baseline building"
            : won
            ? "Wager won"
            : glint
            ? "Called it"
            : "Wager lost"}
        </p>
        <h1
          className="num"
          style={{
            fontSize: 52,
            margin: "10px 0",
            color: won ? "var(--gold)" : glint ? "var(--teal)" : "var(--text)",
          }}
        >
          {data.starDelta >= 0 ? "+" : ""}
          {data.starDelta}
          <span style={{ fontSize: 22 }} className="dim"> ★</span>
        </h1>

        {glint ? (
          <p className="calib" style={{ fontSize: 18, marginBottom: 6 }}>
            You knew.
          </p>
        ) : null}

        {/* Losses always carry one specific fact; never a dead loss. */}
        {data.lossFact ? (
          <p className="dim" style={{ marginBottom: 6 }}>
            {data.lossFact}
          </p>
        ) : null}

        {data.formBeat ? (
          <p className="reso" style={{ marginTop: 10 }}>
            {data.formBeat}
          </p>
        ) : null}

        {typeof data.stars === "number" ? (
          <p className="faint num" style={{ marginTop: 14, fontSize: 13 }}>
            {data.stars} ★ banked
          </p>
        ) : null}
      </motion.div>
      <div className="grow" />
      <button className="btn btn-primary" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}
