// Constellation home hub (BUILD PROMPT Sections 4, 10). Fog constellation +
// resolution + dimension/Form chips + CTA + tomorrow tease + gauntlet banner.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "@/lib/client/api";
import { DIMENSION_META } from "@/lib/dimensions";
import { FORM_LAW_LINE } from "@/lib/compliance";
import { Constellation } from "./Constellation";
import { GauntletBanner } from "@/components/gauntlet/GauntletBanner";
import { ChestMoment } from "@/components/economy/ChestMoment";
import type { DimensionState } from "@/pages/api/state";

interface State {
  dimensions: DimensionState[];
  overallResolution: number;
  hasCompletedToday: boolean;
  tomorrowTease: { dimension: string; label: string };
  stars: number;
  gauntlet: { name: string | null; worldCatchRate: number | null } | null;
}

export function ConstellationHome() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [sheet, setSheet] = useState<DimensionState | null>(null);

  useEffect(() => {
    api<State>("/api/state").then(setState).catch(() => setState(null));
  }, []);

  if (!state) return <div className="screen center dim" style={{ justifyContent: "center" }}>Resolving…</div>;

  const pct = Math.round(state.overallResolution * 100);
  const formChips = state.dimensions.filter((d) => d.form_scaled != null);

  return (
    <div className="screen">
      <ChestMoment />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="kicker">Mind Print</span>
        <span className="num stake">{state.stars} ★</span>
      </div>

      {state.gauntlet ? <GauntletBanner name={state.gauntlet.name} worldCatchRate={state.gauntlet.worldCatchRate} /> : null}

      <div style={{ display: "grid", placeItems: "center", margin: "8px 0" }}>
        <Constellation dimensions={state.dimensions} onTapDimension={setSheet} />
      </div>

      <p className="center reso num" style={{ fontSize: 15, marginBottom: 4 }}>
        Your print is {pct}% resolved
      </p>

      {formChips.length ? (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
          {formChips.map((d) => (
            <span
              key={d.dimension}
              className="num"
              style={{
                fontSize: 12,
                padding: "3px 8px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                color: (d.form_scaled ?? 0) >= 0 ? "var(--teal)" : "var(--gold)",
              }}
            >
              {DIMENSION_META[d.dimension].label} {(d.form_scaled ?? 0) >= 0 ? "+" : ""}
              {d.form_scaled}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grow" />

      {state.hasCompletedToday ? (
        <div className="stack" style={{ gap: 10 }}>
          <p className="center dim">Today&apos;s gauntlet is done.</p>
          <p className="center faint" style={{ fontSize: 13 }}>
            Tomorrow: {state.tomorrowTease.label} comes into focus.
          </p>
          <Link href="/play?review=1" className="btn btn-ghost">
            See today&apos;s card
          </Link>
        </div>
      ) : (
        <Link href="/play" className="btn btn-gold">
          Run today&apos;s gauntlet
        </Link>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginTop: 16 }}>
        <Link href="/settings" className="faint" style={{ fontSize: 13 }}>Settings</Link>
        <span className="faint" style={{ fontSize: 12 }}>{FORM_LAW_LINE}</span>
      </div>

      {sheet ? (
        <DimensionSheet dim={sheet} onClose={() => setSheet(null)} onSharpen={() => router.push(`/play?bonus=${DIMENSION_META[sheet.dimension] ? sheet.dimension : ""}`)} />
      ) : null}
    </div>
  );
}

function DimensionSheet({
  dim,
  onClose,
  onSharpen,
}: {
  dim: DimensionState;
  onClose: () => void;
  onSharpen: () => void;
}) {
  const meta = DIMENSION_META[dim.dimension];
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(6,10,22,0.6)", display: "flex", alignItems: "flex-end", zIndex: 30 }}
    >
      <div
        className="card rise"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, margin: "0 auto", borderRadius: "20px 20px 0 0" }}
      >
        <p className="kicker">{meta.label}</p>
        <p style={{ margin: "8px 0" }}>{meta.blurb}</p>
        <p className="dim" style={{ marginBottom: 4 }}>{meta.sharpenedBy}</p>
        <p className="num faint" style={{ fontSize: 12, marginBottom: 16 }}>
          {Math.round(dim.resolution * 100)}% resolved · {dim.n_trials} runs
        </p>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={onSharpen}>
          Sharpen it now
        </button>
      </div>
    </div>
  );
}
