// Context tag prompt (BUILD PROMPT Section 4.5). One screen, max 2 taps,
// prominent Skip. Stored on the session; correlational insight is phase 2.
import { useState } from "react";

const TAGS: { id: string; label: string }[] = [
  { id: "slept_badly", label: "Slept badly" },
  { id: "slept_great", label: "Slept great" },
  { id: "big_day", label: "Big day" },
  { id: "coffee", label: "Coffee" },
  { id: "tired", label: "Tired" },
  { id: "travel", label: "Travel" },
];

export function ContextTags({ onSubmit }: { onSubmit: (tags: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 2) return s; // max 2
      return [...s, id];
    });
  }

  return (
    <div className="screen">
      <div className="grow" />
      <p className="kicker center">One tap, if you want</p>
      <h1 className="center" style={{ fontSize: 24, margin: "8px 0 20px" }}>Anything shape today?</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {TAGS.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="btn"
              style={{
                minHeight: 56,
                background: on ? "var(--panel-2)" : "transparent",
                border: `1px solid ${on ? "var(--whiteblue)" : "var(--line)"}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="grow" />
      <button className="btn btn-primary" onClick={() => onSubmit(selected)} disabled={selected.length === 0}>
        Save
      </button>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => onSubmit([])}>
        Skip
      </button>
    </div>
  );
}
