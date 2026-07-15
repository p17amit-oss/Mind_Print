// /dev/trial/[type] — play any single trial in isolation (build step 3/4).
// Uses a client-side stub submitter so trials are testable without the session
// backend. The real session flow (Step 7) swaps in a server submitter (/api/run).
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { TrialShell } from "@/components/engine/TrialShell";
import { TRIAL_TYPES, trialMeta, type TrialType } from "@/lib/trials";
import { resolveWager } from "@/lib/engine/wager";
import { pickLossFact } from "@/lib/engine/facts";
import type { ResolutionData, RunSubmitter } from "@/lib/engine/types";

// Authoring playtest: /dev/author/alien-rules stashes an in-progress item here
// and opens /dev/trial/alien_rules?authored=1. We inject it as all 4 matrices so
// the whole run plays the authored item. (Additive dev-harness hook only.)
const AUTHORED_KEY = "mp_authoring_item";

export default function TrialDev() {
  const router = useRouter();
  const type = router.query.type as TrialType | undefined;
  const [stars, setStars] = useState(0);
  const [log, setLog] = useState<ResolutionData[]>([]);
  const [authoredItems, setAuthoredItems] = useState<unknown[] | null>(null);

  const isAuthored = router.query.authored === "1" && type === "alien_rules";
  useEffect(() => {
    if (!isAuthored) return;
    try {
      const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(AUTHORED_KEY) : null;
      if (raw) {
        const item = JSON.parse(raw);
        setAuthoredItems([item, item, item, item]); // whole run = the authored item
      }
    } catch {
      setAuthoredItems(null);
    }
  }, [isAuthored]);

  if (!type || !TRIAL_TYPES.includes(type)) {
    return (
      <div className="screen">
        <p className="kicker">Dev · Trials</p>
        <h1 style={{ fontSize: 22, margin: "8px 0 16px" }}>Pick a trial</h1>
        <div className="stack" style={{ gap: 10 }}>
          {TRIAL_TYPES.map((t) => (
            <a key={t} href={`/dev/trial/${t}`} className="btn btn-ghost">
              {trialMeta(t).title}
            </a>
          ))}
        </div>
      </div>
    );
  }

  // Client-side stub: random 55% success, floors stars, fills a loss fact.
  const submit: RunSubmitter = async ({ trialType, stake, output }) => {
    const success = Math.random() < 0.55;
    const w = resolveWager({ stake, success, baselineBuilding: false });
    const nextStars = Math.max(0, stars + w.starDelta);
    setStars(nextStars);
    const data: ResolutionData = {
      wager_outcome: w.outcome,
      starDelta: w.starDelta,
      calibrationCredit: w.calibrationCredit,
      glint: w.glint,
      lossFact: w.outcome === "lost" ? pickLossFact(trialType, output.summary) : undefined,
      formBeat: "Fog thins a little.",
      coreMetricValue: output.coreMetricValue,
      stars: nextStars,
    };
    setLog((l) => [...l, data]);
    return data;
  };

  return (
    <TrialShell
      key={log.length}
      trialType={type}
      items={isAuthored ? authoredItems ?? [] : undefined}
      submit={submit}
      onFinished={() => {
        if (isAuthored) {
          // Return to the authoring tool after a playtest.
          router.replace("/dev/author/alien-rules");
        } else {
          // Loop for easy dev testing: restart the same trial.
          router.replace(`/dev/trial/${type}`);
        }
      }}
    />
  );
}
