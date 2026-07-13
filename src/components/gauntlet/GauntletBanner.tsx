// Gauntlet event banner (BUILD PROMPT Section 6.6 / 10).
// "The world is catching 54%. You?" — shown during a live event.
export function GauntletBanner({
  name,
  worldCatchRate,
}: {
  name: string | null;
  worldCatchRate: number | null;
}) {
  return (
    <div
      className="card"
      style={{
        borderColor: "var(--signal-red)",
        background: "rgba(255,77,94,0.08)",
        padding: "10px 14px",
        marginBottom: 12,
      }}
    >
      <p className="kicker" style={{ color: "var(--signal-red)" }}>Live event{name ? ` · ${name}` : ""}</p>
      <p className="num" style={{ fontSize: 14, marginTop: 4 }}>
        {worldCatchRate != null
          ? `The world is catching ${worldCatchRate}%. You?`
          : "Fresh fakes are live. Catch what you can."}
      </p>
    </div>
  );
}
