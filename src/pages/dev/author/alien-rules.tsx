// /dev/author/alien-rules — internal authoring tool for the 120 alien_rules
// matrices (BUILD PROMPT Section 6.4). Dev-only; reuses the existing glyph
// primitives and the alien_rules trial flow. Does not modify production trial code.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Glyph } from "@/lib/glyphs/Glyph";
import { GlyphPicker } from "@/components/dev/GlyphPicker";
import { detectRules } from "@/lib/glyphs/rule-detect";
import type { GlyphSpec } from "@/lib/glyphs/types";
import {
  blankState,
  buildContent,
  deriveDesignDifficulty,
  depthBreakdown,
  entryFromState,
  nextItemId,
  suggestProximity,
  toCsv,
  warnings,
  type AuthoringState,
  type BankEntry,
} from "@/lib/dev/alien-authoring";

type Target = { kind: "grid"; index: number } | { kind: "distractor"; index: number };

const DEPTH_DEFS: Record<1 | 2 | 3, string> = {
  1: "Depth 1 — a single progression rule (e.g. count +1 per column).",
  2: "Depth 2 — two composed rules (e.g. progression + distribution).",
  3: "Depth 3 — three composed rules (e.g. progression + XOR + distribution).",
};

const TARGET = 120;

export default function AlienAuthor() {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [state, setState] = useState<AuthoringState>(blankState);
  const [target, setTarget] = useState<Target>({ kind: "grid", index: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch("/api/dev/alien-bank").then((x) => x.json());
    setEntries(r.items ?? []);
  }, []);
  useEffect(() => {
    load().catch(() => setStatus("Could not load bank (is this running under `next dev`?)"));
  }, [load]);

  const report = useMemo(() => detectRules(state.grid), [state.grid]);
  const problems = useMemo(() => warnings(state), [state]);
  const hasError = problems.some((p) => p.level === "error");
  const suggestedProx = suggestProximity(state.distractors);
  const designDifficulty = deriveDesignDifficulty(state.rule_depth, state.distractor_proximity);
  const currentId = editingId ?? nextItemId(entries);

  // ── mutations ──
  const setGridCell = (i: number, spec: GlyphSpec) =>
    setState((s) => ({ ...s, grid: s.grid.map((g, k) => (k === i ? spec : g)) }));
  const setDistractor = (i: number, spec: GlyphSpec) =>
    setState((s) => ({ ...s, distractors: s.distractors.map((d, k) => (k === i ? { ...d, spec } : d)) }));
  const targetSpec: GlyphSpec =
    target.kind === "grid" ? state.grid[target.index] : state.distractors[target.index].spec;
  const setTargetSpec = (spec: GlyphSpec) =>
    target.kind === "grid" ? setGridCell(target.index, spec) : setDistractor(target.index, spec);

  async function save() {
    if (hasError) {
      setStatus("Fix the errors before saving.");
      return;
    }
    const entry = entryFromState(state, currentId);
    const r = await fetch("/api/dev/alien-bank", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", entry }),
    }).then((x) => x.json());
    setEntries(r.items ?? []);
    setEditingId(entry.item_id);
    setStatus(`Saved ${entry.item_id}.`);
  }

  function reset() {
    setState(blankState());
    setEditingId(null);
    setTarget({ kind: "grid", index: 0 });
    setStatus("New item.");
  }

  function edit(e: BankEntry) {
    setState(e.authoring);
    setEditingId(e.item_id);
    setTarget({ kind: "grid", index: 0 });
    setStatus(`Editing ${e.item_id}.`);
  }

  async function del(id: string) {
    const r = await fetch("/api/dev/alien-bank", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "delete", item_id: id }),
    }).then((x) => x.json());
    setEntries(r.items ?? []);
    if (editingId === id) reset();
  }

  function playtest() {
    const content = buildContent(state);
    window.sessionStorage.setItem("mp_authoring_item", JSON.stringify(content));
    window.location.href = "/dev/trial/alien_rules?authored=1";
  }

  function download(name: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const breakdown = depthBreakdown(entries);

  return (
    // Single stacked column — the app shell (#__next) is capped at 480px with
    // overflow-x hidden, so everything lives in one scrollable column.
    <div style={{ padding: 16, maxWidth: 460, margin: "0 auto" }}>
      {/* header */}
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <p className="kicker">Dev · Author · alien_rules</p>
          <h1 style={{ fontSize: 20 }}>
            {editingId ? `Editing ${editingId}` : `New item (${currentId})`}
          </h1>
        </div>
        <div className="num" style={{ textAlign: "right", fontSize: 13 }}>
          <div className="reso">{entries.length} of {TARGET} authored</div>
          <div className="faint">depth 1:{breakdown[1]} · 2:{breakdown[2]} · 3:{breakdown[3]}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "stretch" }}>
        {/* ── section: grid ── */}
        <div>
          <p className="faint num" style={{ fontSize: 12, marginBottom: 6 }}>
            Compose the full matrix, then mark one cell hidden.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, background: "var(--line)", padding: 6, borderRadius: 12 }}>
            {state.grid.map((spec, i) => {
              const hidden = state.hiddenIndex === i;
              const selected = target.kind === "grid" && target.index === i;
              return (
                <button
                  key={i}
                  onClick={() => setTarget({ kind: "grid", index: i })}
                  style={{
                    aspectRatio: "1",
                    background: "var(--field-2)",
                    borderRadius: 8,
                    border: `2px solid ${selected ? "var(--gold)" : hidden ? "var(--signal-red)" : "transparent"}`,
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                  }}
                >
                  <div style={{ opacity: hidden ? 0.25 : 1 }}>
                    <Glyph spec={spec} size={72} />
                  </div>
                  {hidden ? (
                    <span className="fake" style={{ position: "absolute", fontSize: 30, fontWeight: 700 }}>?</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <span className="faint num" style={{ fontSize: 11 }}>hidden cell:</span>
            {state.grid.map((_, i) => (
              <button
                key={i}
                onClick={() => setState((s) => ({ ...s, hiddenIndex: i }))}
                className="btn"
                style={{ minHeight: 26, padding: "2px 8px", fontSize: 11, background: state.hiddenIndex === i ? "var(--signal-red)" : "transparent", border: "1px solid var(--line)", color: state.hiddenIndex === i ? "#2a0308" : "var(--text)" }}
              >
                {i}
              </button>
            ))}
          </div>

          {/* rule preview */}
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <p className="kicker" style={{ marginBottom: 8 }}>Rule preview (heuristic)</p>
            {report.anyClear ? (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, lineHeight: 1.5 }}>
                {report.active.map((r, i) => (
                  <li key={i} className="reso">{r.description}</li>
                ))}
              </ul>
            ) : (
              <p className="fake" style={{ fontSize: 13 }}>No clear rule detected yet.</p>
            )}
            <p className="faint num" style={{ fontSize: 11, marginTop: 8 }}>
              {report.activeCount} active rule(s){report.suggestedDepth ? ` → suggested depth ${report.suggestedDepth}` : ""}
            </p>
          </div>

          {/* rule_depth */}
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <p className="kicker" style={{ marginBottom: 8 }}>rule_depth</p>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setState((s) => ({ ...s, rule_depth: d as 1 | 2 | 3 }))}
                  className="btn"
                  style={{ minHeight: 34, flex: 1, background: state.rule_depth === d ? "var(--panel-2)" : "transparent", border: `1px solid ${state.rule_depth === d ? "var(--whiteblue)" : "var(--line)"}` }}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="faint" style={{ fontSize: 12, lineHeight: 1.4 }}>{DEPTH_DEFS[state.rule_depth]}</p>
          </div>
        </div>

        {/* ── column 2: picker ── */}
        <div>
          <p className="faint num" style={{ fontSize: 12, marginBottom: 6 }}>
            Editing: {target.kind === "grid" ? `grid cell ${target.index}${state.hiddenIndex === target.index ? " (hidden = correct answer)" : ""}` : `distractor ${target.index + 1}`}
          </p>
          <GlyphPicker value={targetSpec} onChange={setTargetSpec} />
        </div>

        {/* ── column 3: options + warnings + actions ── */}
        <div>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <p className="kicker" style={{ marginBottom: 8 }}>Answer options</p>
            {/* correct */}
            <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ border: "2px solid var(--teal)", borderRadius: 8, padding: 4 }}>
                <Glyph spec={state.grid[state.hiddenIndex]} size={48} />
              </div>
              <div>
                <div className="calib">Correct — = hidden cell</div>
                <div className="faint num" style={{ fontSize: 11 }}>satisfies every rule by construction</div>
              </div>
            </div>
            {/* distractors */}
            {state.distractors.map((d, i) => {
              const selected = target.kind === "distractor" && target.index === i;
              return (
                <div key={i} className="row" style={{ gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <button
                    onClick={() => setTarget({ kind: "distractor", index: i })}
                    style={{ border: `2px solid ${selected ? "var(--gold)" : "var(--line)"}`, borderRadius: 8, padding: 4, background: "transparent" }}
                  >
                    <Glyph spec={d.spec} size={48} />
                  </button>
                  <div>
                    <div style={{ fontSize: 13 }}>Distractor {i + 1}</div>
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      <span className="faint num" style={{ fontSize: 11 }}>proximity</span>
                      {[0, 1, 2].map((v) => (
                        <button
                          key={v}
                          title={["obvious", "plausible", "near-miss"][v]}
                          onClick={() => setState((s) => ({ ...s, distractors: s.distractors.map((x, k) => (k === i ? { ...x, proximity: v as 0 | 1 | 2 } : x)) }))}
                          className="btn"
                          style={{ minHeight: 24, padding: "1px 8px", fontSize: 11, background: d.proximity === v ? "var(--panel-2)" : "transparent", border: `1px solid ${d.proximity === v ? "var(--whiteblue)" : "var(--line)"}` }}
                        >
                          {v}
                        </button>
                      ))}
                      <span className="faint num" style={{ fontSize: 11 }}>{["obvious", "plausible", "near-miss"][d.proximity]}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* distractor_proximity */}
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <p className="kicker">distractor_proximity</p>
              <span className="faint num" style={{ fontSize: 11 }}>suggested {suggestedProx}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              {[0, 1, 2].map((p) => (
                <button
                  key={p}
                  onClick={() => setState((s) => ({ ...s, distractor_proximity: p as 0 | 1 | 2 }))}
                  className="btn"
                  style={{ minHeight: 32, flex: 1, background: state.distractor_proximity === p ? "var(--panel-2)" : "transparent", border: `1px solid ${state.distractor_proximity === p ? "var(--whiteblue)" : "var(--line)"}` }}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="faint" style={{ fontSize: 11, marginTop: 6 }}>0 = obviously wrong · 2 = near-misses (hard). design_difficulty → {designDifficulty}</p>
          </div>

          {/* warnings */}
          {problems.length ? (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <p className="kicker" style={{ marginBottom: 8 }}>Checks</p>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.5 }}>
                {problems.map((p, i) => (
                  <li key={i} style={{ color: p.level === "error" ? "var(--signal-red)" : p.level === "warn" ? "var(--gold)" : "var(--text-dim)" }}>
                    {p.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <p className="calib" style={{ fontSize: 13 }}>✓ No issues detected.</p>
            </div>
          )}

          {/* actions */}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-gold" style={{ flex: 1 }} disabled={hasError} onClick={save}>
              {editingId ? "Save changes" : "Save item"}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={playtest}>Playtest</button>
            <button className="btn btn-ghost" onClick={reset}>New</button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => download("alien_rules_bank.csv", toCsv(entries), "text/csv")}>Export CSV (Airtable)</button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => download("alien_rules_bank.json", JSON.stringify(entries, null, 2), "application/json")}>Export JSON</button>
          </div>
          {status ? <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>{status}</p> : null}
        </div>
      </div>

      {/* saved items */}
      <div style={{ marginTop: 20 }}>
        <p className="kicker" style={{ marginBottom: 8 }}>Bank ({entries.length})</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {entries.map((e) => (
            <div key={e.item_id} className="row" style={{ gap: 4, border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px" }}>
              <button onClick={() => edit(e)} className="num" style={{ background: "transparent", fontSize: 12, color: editingId === e.item_id ? "var(--gold)" : "var(--whiteblue)" }}>
                {e.item_id} · d{e.content.rule_depth}
              </button>
              <button onClick={() => del(e.item_id)} className="faint" style={{ background: "transparent", fontSize: 12 }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
