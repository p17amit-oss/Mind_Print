// Daily card + share placeholder (BUILD PROMPT Section 11). Full OG card + share
// flow land in Step 9; this shows the card and the open-loop line for now.
export function DailyCardShare({ onDone }: { sessionId: string; onDone: () => void }) {
  return (
    <div className="screen center">
      <div className="grow" />
      <p className="kicker">Today&apos;s card</p>
      <h1 style={{ fontSize: 24, margin: "10px 0" }}>Your gauntlet, sealed.</h1>
      <p className="dim" style={{ marginBottom: 24 }}>Share flow arrives in Step 9.</p>
      <div className="grow" />
      <button className="btn btn-primary" onClick={onDone}>Done</button>
      <p className="faint center" style={{ fontSize: 13, marginTop: 14 }}>
        Come back tomorrow — the fog moves overnight.
      </p>
    </div>
  );
}
