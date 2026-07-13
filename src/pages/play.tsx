// /play — the daily session flow (BUILD PROMPT Section 4).
// plan → 3× (wager → trial → resolution) → Double-or-Bank → fog → Form →
// context tags → daily card → (adults, once) research consent → home.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { TrialShell } from "@/components/engine/TrialShell";
import { DoubleOrBank } from "@/components/economy/DoubleOrBank";
import { FormReadout, type FormChipData } from "@/components/session/FormReadout";
import { ContextTags } from "@/components/session/ContextTags";
import { DailyCardShare } from "@/components/session/DailyCardShare";
import { ConsentScreen } from "@/components/onboarding/ConsentScreen";
import { FogClear } from "@/components/session/FogClear";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/track";
import { TRIAL_TYPES, type TrialType } from "@/lib/trials";
import type { Stake } from "@/lib/engine/wager";
import type { ResolutionData, RunSubmitter } from "@/lib/engine/types";

interface PlanTrial {
  trialType: TrialType;
  chaos: boolean;
  difficulty: Record<string, unknown>;
  items: unknown[];
  lastStake: number;
}
interface PlanResp {
  sessionId: string;
  trials: PlanTrial[];
  inGauntlet: boolean;
  gauntletEventId: string | null;
}

type Phase = "loading" | "trial" | "dob" | "fog" | "form" | "tags" | "card" | "research" | "bonus" | "done";

export default function Play() {
  return (
    <OnboardingGate>
      <PlayFlow />
    </OnboardingGate>
  );
}

function PlayFlow() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<PlanResp | null>(null);
  const [trialIndex, setTrialIndex] = useState(0);
  const [wins, setWins] = useState(0);
  const [form, setForm] = useState<FormChipData[]>([]);
  const [promptResearch, setPromptResearch] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const started = useRef(false);

  const bonus = typeof router.query.bonus === "string" && TRIAL_TYPES.includes(router.query.bonus as TrialType)
    ? (router.query.bonus as TrialType)
    : null;

  // ── bootstrap ──
  useEffect(() => {
    if (!router.isReady || started.current) return;
    started.current = true;

    if (bonus) {
      const key = `mp_bonus_${new Date().toISOString().slice(0, 10)}`;
      if (typeof window !== "undefined" && window.localStorage.getItem(key)) {
        router.replace("/"); // 1 bonus trial / day cap
        return;
      }
      if (typeof window !== "undefined") window.localStorage.setItem(key, "1");
      track("bonus_trial", { trial: bonus });
      setPhase("bonus");
      return;
    }

    api<PlanResp>("/api/session/plan", { method: "POST", body: {} })
      .then((p) => {
        setPlan(p);
        setSessionId(p.sessionId);
        setPhase("trial");
      })
      .catch(() => router.replace("/"));
  }, [router.isReady, bonus, router]);

  const submitRun: RunSubmitter = useCallback(
    async ({ trialType, chaos, stake, output }) => {
      const { resolution } = await api<{ resolution: ResolutionData }>("/api/run", {
        body: { sessionId, trialType, chaos, stake, output, isBonus: !!bonus },
      });
      return resolution;
    },
    [sessionId, bonus]
  );

  // ── bonus: single trial then home ──
  if (phase === "bonus" && bonus) {
    return (
      <TrialShell
        trialType={bonus}
        submit={submitRun}
        onFinished={async () => {
          await api("/api/score/recompute", { method: "POST", body: {} }).catch(() => {});
          router.replace("/");
        }}
      />
    );
  }

  if (phase === "loading" || !plan) {
    return <div className="screen center dim" style={{ justifyContent: "center" }}>Planning your gauntlet…</div>;
  }

  // ── trials ──
  if (phase === "trial") {
    const t = plan.trials[trialIndex];
    return (
      <TrialShell
        key={trialIndex}
        trialType={t.trialType}
        chaos={t.chaos}
        difficulty={t.difficulty}
        items={t.items}
        lastStake={(t.lastStake as Stake) ?? 2}
        sessionId={plan.sessionId}
        submit={submitRun}
        onFinished={(res) => {
          if (res.wager_outcome === "won" || res.wager_outcome === "baseline_building") setWins((w) => w + 1);
          if (trialIndex + 1 < plan.trials.length) {
            setTrialIndex((i) => i + 1);
          } else {
            // After trial 3: Double-or-Bank if eligible (won >= 2 wagers).
            const eligible = wins + (res.wager_outcome === "won" || res.wager_outcome === "baseline_building" ? 1 : 0) >= 2;
            setPhase(eligible ? "dob" : "fog");
          }
        }}
      />
    );
  }

  if (phase === "dob") {
    return <DoubleOrBank onDone={() => setPhase("fog")} />;
  }

  if (phase === "fog") {
    return (
      <FogClear
        onDone={async () => {
          const r = await api<{ form: FormChipData[]; shouldPromptResearch: boolean }>(
            "/api/session/complete",
            { body: {} }
          );
          setForm(r.form ?? []);
          setPromptResearch(!!r.shouldPromptResearch);
          setPhase("form");
        }}
      />
    );
  }

  if (phase === "form") {
    return <FormReadout chips={form} onNext={() => setPhase("tags")} />;
  }

  if (phase === "tags") {
    return (
      <ContextTags
        onSubmit={async (tags) => {
          await api("/api/session/tags", { body: { tags } }).catch(() => {});
          setPhase("card");
        }}
      />
    );
  }

  if (phase === "card") {
    return (
      <DailyCardShare
        sessionId={plan.sessionId}
        onDone={() => setPhase(promptResearch ? "research" : "done")}
      />
    );
  }

  if (phase === "research") {
    return <ConsentScreen type="research_participation" onDone={() => setPhase("done")} />;
  }

  // done
  if (phase === "done") router.replace("/");
  return <div className="screen center dim" style={{ justifyContent: "center" }}>…</div>;
}
