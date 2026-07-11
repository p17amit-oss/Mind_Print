// Settings — view/revoke research consent (BUILD PROMPT Section 3).
// Revocation sets revoked_at; the research views respect it immediately.
import { useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/client/useMe";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/track";
import { PROFILE_FOOTER } from "@/lib/compliance";

export default function Settings() {
  const { me, loading, refresh } = useMe();
  const [busy, setBusy] = useState(false);

  if (loading || !me) return <div className="screen dim">Loading…</div>;

  const research = me.consent.research_participation;
  const adult = me.user.is_adult === true;

  async function setResearch(decision: "grant" | "revoke") {
    setBusy(true);
    try {
      await api("/api/consent", { body: { type: "research_participation", decision } });
      track("research_consent", { result: decision === "grant" ? "granted" : "revoked" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24 }}>Settings</h1>
        <Link href="/" className="btn btn-ghost" style={{ minHeight: 40, padding: "8px 14px" }}>
          Done
        </Link>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <p className="kicker">Research participation</p>
        {!adult ? (
          <p className="dim">Research participation is available to adults only.</p>
        ) : research === "granted" ? (
          <>
            <p>You&apos;re contributing to aggregate research. Thank you.</p>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setResearch("revoke")}>
              Turn off research participation
            </button>
          </>
        ) : (
          <>
            <p className="dim">
              You&apos;re not contributing to research. Your play still works exactly the same.
            </p>
            <button className="btn btn-primary" disabled={busy} onClick={() => setResearch("grant")}>
              Turn on research participation
            </button>
          </>
        )}
      </div>

      <div className="grow" />
      <p className="faint" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 24 }}>
        {PROFILE_FOOTER}
      </p>
    </div>
  );
}
