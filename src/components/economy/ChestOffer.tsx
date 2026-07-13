// Chest offer (BUILD PROMPT Section 5). Every 7th session: claim now, or a bigger
// chest in a few days. One tap. No UI explains the trade — it's just a nice choice.
import { useState } from "react";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/track";
import { sfx } from "@/lib/client/sfx";

export function ChestOffer({
  offer,
  onDone,
}: {
  offer: { now_n: number; later_n: number; delay_days: number };
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function choose(chose: "now" | "later") {
    if (busy) return;
    setBusy(true);
    sfx("tap");
    track("chest_choice", { chose });
    await api("/api/chest/choose", { body: { chose } }).catch(() => {});
    onDone();
  }

  return (
    <div className="screen center">
      <div className="grow" />
      <div style={{ fontSize: 64 }}>🗝️</div>
      <h1 style={{ fontSize: 24, margin: "12px 0" }}>A chest appears.</h1>
      <p className="dim" style={{ marginBottom: 28 }}>Your call.</p>
      <div className="grow" />
      <button className="btn btn-gold" disabled={busy} onClick={() => choose("now")}>
        Claim {offer.now_n} ★ now
      </button>
      <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={busy} onClick={() => choose("later")}>
        {offer.later_n} ★ in {offer.delay_days} days
      </button>
    </div>
  );
}
