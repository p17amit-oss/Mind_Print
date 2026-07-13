// read_room (BUILD PROMPT Section 6.5) — dimension: social_read (+ jury values)
// Standard: predict the crowd's modal answer. Jury: layer 1 = your verdict (no
// score), layer 2 = predict the crowd's verdict (scored, feeds social_read).
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/client/sfx";
import { round } from "@/lib/engine/metrics";
import {
  buildRoomRun,
  isJury,
  modalIndex,
  type RoomItem,
} from "@/lib/trials/roombank";
import type { TrialComponentProps, TrialEventLog } from "@/lib/engine/types";

type Phase = "answer" | "verdict" | "predict" | "reveal";

export function ReadRoom({ items, onComplete }: TrialComponentProps) {
  const run = useMemo<RoomItem[]>(
    () => ((items as RoomItem[])?.length ? (items as RoomItem[]) : buildRoomRun()),
    [items]
  );
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (isJury(run[0]) ? "verdict" : "answer"));
  const [choice, setChoice] = useState<number | null>(null);
  const [myVerdict, setMyVerdict] = useState<number | null>(null);

  const events = useRef<TrialEventLog[]>([]);
  const scored = useRef({ matched: 0, total: 0 });
  const finished = useRef(false);

  const item = run[qIdx];

  function nextQuestion() {
    setChoice(null);
    setMyVerdict(null);
    if (qIdx + 1 >= run.length) return finish();
    const next = run[qIdx + 1];
    setQIdx((i) => i + 1);
    setPhase(isJury(next) ? "verdict" : "answer");
  }

  // ── standard: predict the modal answer ──
  function answerStandard(i: number) {
    if (choice !== null || isJury(item)) return;
    const modal = modalIndex(item.distribution);
    const correct = i === modal;
    setChoice(i);
    scored.current.total++;
    if (correct) scored.current.matched++;
    sfx(correct ? "chime" : "glitch");
    events.current.push({
      seq: qIdx,
      item_ref: item.item_id,
      response: { choice: i },
      correct,
    });
    setPhase("reveal");
  }

  // ── jury layer 1: your verdict (no score, correct=NULL) ──
  function castVerdict(i: number) {
    if (!isJury(item)) return;
    setMyVerdict(i);
    sfx("tap");
    events.current.push({
      seq: qIdx,
      item_ref: item.item_id,
      // response carries `verdict` — this is the layer-1 event the research view
      // (v_jury_distributions) reads via `response ? 'verdict'`.
      response: { verdict: i },
      correct: null,
    });
    setPhase("predict");
  }

  // ── jury layer 2: predict the crowd verdict (scored) ──
  function predictCrowd(i: number) {
    if (!isJury(item) || choice !== null) return;
    const modal = modalIndex(item.verdictDistribution);
    const correct = i === modal;
    setChoice(i);
    scored.current.total++;
    if (correct) scored.current.matched++;
    sfx(correct ? "chime" : "glitch");
    events.current.push({
      seq: qIdx,
      item_ref: item.item_id,
      // `prediction` (not `verdict`) so this stays gameplay data, not a jury verdict.
      response: { prediction: i },
      correct,
    });
    setPhase("reveal");
  }

  function finish() {
    if (finished.current) return;
    finished.current = true;
    const acc = scored.current.total ? scored.current.matched / scored.current.total : 0;
    onComplete({
      events: events.current,
      summary: {
        accuracy: round(acc * 100),
        matched: scored.current.matched,
        questions: scored.current.total,
      },
      difficultyState: {},
      coreMetricValue: round(acc * 100), // higher is better
    });
  }

  const sponsor = "sponsor" in item ? item.sponsor : null;

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="kicker">Read the room · {qIdx + 1}/{run.length}</span>
        {sponsor ? (
          <span
            className="num"
            style={{ fontSize: 11, color: "var(--gold)", border: "1px solid var(--gold)", borderRadius: 6, padding: "2px 6px" }}
          >
            Sponsored
          </span>
        ) : null}
      </div>

      <div className="grow" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {isJury(item) ? (
          <>
            <h2 style={{ fontSize: 20, lineHeight: 1.4, marginBottom: 8 }}>{item.scenario}</h2>
            <p className="dim" style={{ marginBottom: 20 }}>
              {phase === "verdict"
                ? "Your call. No right answer."
                : phase === "predict"
                ? "Now — what did MOST players say?"
                : "The room decides."}
            </p>
            {phase === "verdict" &&
              item.verdictOptions.map((o, i) => (
                <Option key={i} label={o} onClick={() => castVerdict(i)} />
              ))}
            {phase === "predict" &&
              item.verdictOptions.map((o, i) => (
                <Option key={i} label={o} onClick={() => predictCrowd(i)} />
              ))}
            {phase === "reveal" && (
              <Distribution
                options={item.verdictOptions}
                dist={item.verdictDistribution}
                yourPick={choice}
                yourOther={myVerdict}
                otherLabel="your verdict"
                onNext={nextQuestion}
              />
            )}
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 20 }}>{item.prompt}</h2>
            {phase === "answer" &&
              item.options.map((o, i) => (
                <Option key={i} label={o} onClick={() => answerStandard(i)} />
              ))}
            {phase === "reveal" && (
              <Distribution
                options={item.options}
                dist={item.distribution}
                yourPick={choice}
                onNext={nextQuestion}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Option({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="btn btn-ghost" style={{ marginBottom: 10, justifyContent: "flex-start" }} onClick={onClick}>
      {label}
    </button>
  );
}

function Distribution({
  options,
  dist,
  yourPick,
  yourOther,
  otherLabel,
  onNext,
}: {
  options: string[];
  dist: number[];
  yourPick: number | null;
  yourOther?: number | null;
  otherLabel?: string;
  onNext: () => void;
}) {
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  const modal = modalIndex(dist);
  return (
    <div>
      {options.map((o, i) => {
        const pct = Math.round((dist[i] / total) * 100);
        const isModal = i === modal;
        const isYou = i === yourPick;
        return (
          <div key={i} style={{ marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
              <span>
                {o}{" "}
                {isYou ? <span className="calib">· your call</span> : null}
                {yourOther === i ? <span className="reso"> · {otherLabel}</span> : null}
              </span>
              <span className="num dim">{pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--line)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ height: "100%", background: isModal ? "var(--teal)" : "var(--panel-2)" }}
              />
            </div>
          </div>
        );
      })}
      <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={onNext}>
        Continue
      </button>
    </div>
  );
}
