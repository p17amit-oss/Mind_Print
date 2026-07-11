// Age gate (BUILD PROMPT Section 3, step 1). <18 => gameplay only, no research.
import { useState } from "react";
import { api } from "@/lib/client/api";
import { AGE_BANDS, type AgeBand } from "@/lib/consent";

export function AgeGate({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function pick(band: AgeBand) {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/age-gate", { body: { age_band: band } });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen center rise">
      <div className="grow" />
      <p className="kicker">Mind Print</p>
      <h1 style={{ fontSize: 30, margin: "12px 0 8px" }}>How old are you?</h1>
      <p className="dim" style={{ marginBottom: 28 }}>
        We ask once. It sets what the game can and can&apos;t do with your play.
      </p>
      <div className="stack" style={{ gap: 12 }}>
        {AGE_BANDS.map((band) => (
          <button
            key={band}
            className="btn btn-ghost num"
            disabled={busy}
            onClick={() => pick(band)}
          >
            {band}
          </button>
        ))}
      </div>
      <div className="grow" />
    </div>
  );
}
