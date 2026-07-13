// Double-or-Bank (BUILD PROMPT Section 5). After trial 3 (won >=2 wagers): bank
// the stars, or ride them on one hard bonus round — double or nothing. 4s
// countdown, default = Bank. Logged to preference_events (kind='double_or_bank').
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/track";
import { sfx } from "@/lib/client/sfx";
import { getTrialComponent } from "@/components/trials/registry";
import type { TrialType } from "@/lib/trials";
import type { TrialOutput } from "@/lib/engine/types";

interface Offer {
  eligible: boolean;
  offeredN?: number;
  trialType?: TrialType;
  difficulty?: Record<string, unknown>;
}
type Phase = "loading" | "offer" | "ride" | "result";
const COUNTDOWN_MS = 4000;

export function DoubleOrBank({ onDone }: { onDone: () => void }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [remaining, setRemaining] = useState(COUNTDOWN_MS);
  const [result, setResult] = useState<{ outcome: string | null; delta: number } | null>(null);
  const decided = useRef(false);

  useEffect(() => {
    api<Offer>("/api/dob/offer", { method: "POST", body: {} })
      .then((o) => {
        if (!o.eligible) return onDone();
        setOffer(o);
        setPhase("offer");
      })
      .catch(() => onDone());
  }, [onDone]);

  useEffect(() => {
    if (phase !== "offer") return;
    const start = Date.now();
    const id = setInterval(() => {
      const left = COUNTDOWN_MS - (Date.now() - start);
      if (left <= 0) {
        clearInterval(id);
        bank();
      } else setRemaining(left);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function bank() {
    if (decided.current) return;
    decided.current = true;
    track("double_or_bank", { chose: "bank" });
    sfx("win");
    await api("/api/dob/resolve", { body: { chose: "bank" } }).catch(() => {});
    onDone();
  }

  function ride() {
    if (decided.current) return;
    decided.current = true;
    track("double_or_bank", { chose: "ride" });
    setPhase("ride");
  }

  async function onBonusComplete(output: TrialOutput) {
    const r = await api<{ outcome: string | null; delta: number }>("/api/dob/resolve", {
      body: { chose: "ride", trialType: offer?.trialType, output },
    }).catch(() => ({ outcome: null, delta: 0 }));
    setResult(r);
    sfx(r.outcome === "won" ? "win" : "loss");
    setPhase("result");
  }

  if (phase === "loading" || !offer) {
    return <div className="screen center dim" style={{ justifyContent: "center" }}>…</div>;
  }

  if (phase === "ride" && offer.trialType) {
    const Bonus = getTrialComponent(offer.trialType);
    return (
      <div>
        <p className="kicker center" style={{ paddingTop: 16 }}>Bonus round · double or nothing</p>
        <Bonus chaos={false} difficulty={offer.difficulty ?? {}} items={[]} onComplete={onBonusComplete} />
      </div>
    );
  }

  if (phase === "result" && result) {
    const won = result.outcome === "won";
    return (
      <div className="screen center">
        <div className="grow" />
        <h1 className="num" style={{ fontSize: 44, color: won ? "var(--gold)" : "var(--text-dim)" }}>
          {result.delta >= 0 ? "+" : ""}
          {result.delta} ★
        </h1>
        <p className="dim" style={{ marginTop: 8 }}>{won ? "You rode it and won." : "Gone. Worth the ride."}</p>
        <div className="grow" />
        <button className="btn btn-primary" onClick={onDone}>Continue</button>
      </div>
    );
  }

  // offer
  return (
    <div className="screen center">
      <div className="grow" />
      <p className="kicker">You won big</p>
      <h1 style={{ fontSize: 26, margin: "10px 0" }}>Bank it, or ride it?</h1>
      <p className="dim" style={{ marginBottom: 24 }}>
        Bank <span className="stake num">+{offer.offeredN} ★</span>, or ride them — one 20-second
        bonus round, double or nothing.
      </p>
      <div className="grow" />
      <button className="btn btn-gold" onClick={ride}>Ride it</button>
      <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={bank}>
        Bank +{offer.offeredN} ★
      </button>
      <div style={{ height: 6, marginTop: 12, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${(remaining / COUNTDOWN_MS) * 100}%` }}
          transition={{ ease: "linear", duration: 0.05 }}
          style={{ height: "100%", background: "var(--panel-2)" }}
        />
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>Banks automatically in {Math.ceil(remaining / 1000)}s</p>
    </div>
  );
}
