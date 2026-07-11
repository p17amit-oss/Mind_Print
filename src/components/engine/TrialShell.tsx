// Trial engine shell — wager → trial → resolution state machine (build step 3).
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WagerScreen } from "./WagerScreen";
import { ResolutionScreen } from "./ResolutionScreen";
import { getTrialComponent } from "@/components/trials/registry";
import { track } from "@/lib/client/track";
import type { TrialType } from "@/lib/trials";
import type { Stake } from "@/lib/engine/wager";
import type { ResolutionData, RunSubmitter, TrialOutput } from "@/lib/engine/types";

type Phase = "wager" | "playing" | "resolving";

export function TrialShell({
  trialType,
  chaos = false,
  difficulty = {},
  items = [],
  lastStake = 2,
  sessionId,
  submit,
  onFinished,
}: {
  trialType: TrialType;
  chaos?: boolean;
  difficulty?: Record<string, unknown>;
  items?: unknown[];
  lastStake?: Stake;
  sessionId?: string;
  submit: RunSubmitter;
  onFinished: (res: ResolutionData) => void;
}) {
  const [phase, setPhase] = useState<Phase>("wager");
  const [stake, setStake] = useState<Stake>(lastStake);
  const [resolution, setResolution] = useState<ResolutionData | null>(null);
  const [busy, setBusy] = useState(false);

  const TrialComponent = getTrialComponent(trialType);

  function onConfirm(s: Stake) {
    setStake(s);
    track("wager_placed", { trial: trialType, stake: s }, sessionId);
    setPhase("playing");
  }

  async function onComplete(output: TrialOutput) {
    if (busy) return;
    setBusy(true);
    track("trial_complete", { trial: trialType, chaos }, sessionId);
    try {
      const res = await submit({ trialType, chaos, stake, output });
      setResolution(res);
      setPhase("resolving");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "wager" && (
        <motion.div key="wager" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WagerScreen trialType={trialType} chaos={chaos} lastStake={lastStake} onConfirm={onConfirm} />
        </motion.div>
      )}
      {phase === "playing" && (
        <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <TrialComponent chaos={chaos} difficulty={difficulty} items={items} onComplete={onComplete} />
        </motion.div>
      )}
      {phase === "resolving" && resolution && (
        <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ResolutionScreen data={resolution} onNext={() => onFinished(resolution)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
