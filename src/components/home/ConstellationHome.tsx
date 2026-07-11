// Constellation home — full implementation lands in Step 7 (Section 10 & 4).
// Stub for now so onboarding is reachable end-to-end.
import Link from "next/link";

export function ConstellationHome() {
  return (
    <div className="screen center">
      <div className="grow" />
      <p className="kicker">Mind Print</p>
      <h1 style={{ fontSize: 28, margin: "12px 0" }}>Your print is forming.</h1>
      <p className="dim" style={{ marginBottom: 28 }}>
        The constellation and daily gauntlet arrive here.
      </p>
      <Link href="/play" className="btn btn-gold">
        Run today&apos;s gauntlet
      </Link>
      <div className="grow" />
      <Link href="/settings" className="faint" style={{ fontSize: 13 }}>
        Settings
      </Link>
    </div>
  );
}
