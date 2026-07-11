// Reusable consent screen (BUILD PROMPT Section 3).
// For research_participation, decline is a first-class equal-weight button.
import { useState } from "react";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/track";
import { CONSENT_COPY, type ConsentType } from "@/lib/consent";

export function ConsentScreen({
  type,
  onDone,
}: {
  type: ConsentType;
  onDone: (decision: "grant" | "decline") => void;
}) {
  const copy = CONSENT_COPY[type];
  const [busy, setBusy] = useState(false);

  async function decide(decision: "grant" | "decline") {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/consent", { body: { type, decision } });
      if (type === "research_participation") {
        track("research_consent", { result: decision === "grant" ? "granted" : "declined" });
      }
      onDone(decision);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen rise">
      <div className="grow" />
      <p className="kicker">{type === "research_participation" ? "Optional" : "Terms"}</p>
      <h1 style={{ fontSize: 26, margin: "10px 0 16px" }}>{copy.title}</h1>
      <div className="stack" style={{ gap: 14, marginBottom: 28 }}>
        {copy.body.map((line, i) => (
          <p key={i} className={i === 0 ? "" : "dim"} style={{ lineHeight: 1.5 }}>
            {line}
          </p>
        ))}
      </div>
      <div className="grow" />
      {/* Equal-weight decline for research consent (unbundled, Section 3). */}
      {copy.declineLabel ? (
        <div className="row" style={{ gap: 12 }}>
          <button className="btn btn-ghost grow" disabled={busy} onClick={() => decide("decline")}>
            {copy.declineLabel}
          </button>
          <button className="btn btn-primary grow" disabled={busy} onClick={() => decide("grant")}>
            {copy.acceptLabel}
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" disabled={busy} onClick={() => decide("grant")}>
          {copy.acceptLabel}
        </button>
      )}
    </div>
  );
}
