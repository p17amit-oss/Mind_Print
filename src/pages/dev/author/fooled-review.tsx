// /dev/author/fooled-review — review + approve staged fooled items (Section 6.6).
// Dev-only. Renders each item, shows provenance, and offers Approve / Reject /
// Edit-tier. Live dashboard of source × modality × tier with an undersized-tier
// warning as the batch nears completion.
import { useCallback, useEffect, useState } from "react";
import type { FooledCounts, StagedFooledItem } from "@/lib/dev/fooled-ingest";

interface BankResponse {
  staged: StagedFooledItem[];
  approved: StagedFooledItem[];
  countsStaged: FooledCounts;
  countsApproved: FooledCounts;
  undersized: number[];
  nearDone: boolean;
  target: number;
}

export default function FooledReview() {
  const [data, setData] = useState<BankResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/dev/fooled-bank").then((x) => x.json());
    setData(r);
  }, []);
  useEffect(() => {
    load().catch(() => setData(null));
  }, [load]);

  async function act(item_id: string, body: Record<string, unknown>) {
    setBusy(item_id);
    try {
      await fetch("/api/dev/fooled-bank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ item_id, ...body }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="screen dim" style={{ padding: 16 }}>Loading… (run `next dev`)</div>;

  return (
    <div style={{ padding: 16, maxWidth: 460, margin: "0 auto" }}>
      <p className="kicker">Dev · Author · fooled review</p>
      <h1 style={{ fontSize: 20, margin: "6px 0 12px" }}>Batch review</h1>

      <Dashboard data={data} />

      <p className="kicker" style={{ margin: "18px 0 8px" }}>Staged ({data.staged.length})</p>
      {data.staged.length === 0 ? (
        <p className="dim" style={{ fontSize: 13 }}>
          Nothing staged. Run <span className="num">npm run ingest:fooled -- &lt;manifest&gt;</span>.
        </p>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {data.staged.map((it) => (
            <ItemCard key={it.item_id} item={it} busy={busy === it.item_id} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ data }: { data: BankResponse }) {
  const a = data.countsApproved;
  const s = data.countsStaged;
  const cell = (src: "human" | "ai", mod: "image" | "text", t: number) =>
    a.bySourceModalityTier[`${src}|${mod}|t${t}`] ?? 0;

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <p className="kicker">Approved {a.total} / {data.target}</p>
        <span className="num faint" style={{ fontSize: 12 }}>staged {s.total}</span>
      </div>

      {/* 100/100 split */}
      <div className="row num" style={{ gap: 12, fontSize: 12, marginBottom: 10 }}>
        <span>human <b className={a.bySource.human >= 100 ? "calib" : ""}>{a.bySource.human}</b>/100</span>
        <span>ai <b className={a.bySource.ai >= 100 ? "calib" : ""}>{a.bySource.ai}</b>/100</span>
        <span className="faint">img {a.byModality.image} · txt {a.byModality.text}</span>
      </div>

      {/* source × modality × tier grid (approved) */}
      <div style={{ overflowX: "auto" }}>
        <table className="num" style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
          <thead>
            <tr className="faint">
              <th style={{ textAlign: "left", padding: "2px 6px" }}>src·mod</th>
              {[1, 2, 3, 4].map((t) => (
                <th key={t} style={{ padding: "2px 6px" }}>t{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["human", "ai"] as const).flatMap((src) =>
              (["image", "text"] as const).map((mod) => (
                <tr key={`${src}-${mod}`}>
                  <td style={{ padding: "2px 6px" }}>{src.slice(0, 3)}·{mod.slice(0, 3)}</td>
                  {[1, 2, 3, 4].map((t) => (
                    <td key={t} style={{ padding: "2px 6px", textAlign: "center" }}>{cell(src, mod, t)}</td>
                  ))}
                </tr>
              ))
            )}
            <tr className="reso" style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "2px 6px" }}>tier Σ</td>
              {([1, 2, 3, 4] as const).map((t) => (
                <td key={t} style={{ padding: "2px 6px", textAlign: "center", color: a.byTier[t] < 20 ? "var(--gold)" : undefined }}>
                  {a.byTier[t]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {data.nearDone && data.undersized.length ? (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(245,196,81,0.12)", border: "1px solid var(--gold)" }}>
          <p className="num" style={{ fontSize: 12, color: "var(--gold)" }}>
            ⚠ Near done, but tier(s) {data.undersized.join(", ")} are below 20 — fill before declaring the batch complete.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ItemCard({
  item,
  busy,
  act,
}: {
  item: StagedFooledItem;
  busy: boolean;
  act: (id: string, body: Record<string, unknown>) => void;
}) {
  const prov = item.provenance;
  return (
    <div className="card" style={{ padding: 12, opacity: busy ? 0.5 : 1 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="num" style={{ fontSize: 12 }}>{item.item_id}</span>
        <span className="num faint" style={{ fontSize: 11 }}>{item.category} · {prov.source_type} · #{item.content_hash.slice(0, 8)}</span>
      </div>

      {/* rendered stimulus */}
      {item.category === "text" ? (
        <div style={{ background: "var(--field-2)", borderRadius: 8, padding: 12, fontSize: 15, lineHeight: 1.5 }}>
          {item.content.text}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.source.url ?? `/api/dev/fooled-asset?item_id=${encodeURIComponent(item.item_id)}`}
          alt={item.item_id}
          style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 8, background: "var(--field-2)" }}
        />
      )}

      {/* provenance */}
      <div className="num faint" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>
        {prov.source_type === "human" ? (
          <>rights: <span className="calib">{prov.rights}</span> · source_ref: {prov.source_ref}</>
        ) : (
          <>model: {item.generator_model} · created: {prov.created}</>
        )}
      </div>

      {/* tier editor */}
      <div className="row" style={{ gap: 6, marginTop: 10, alignItems: "center" }}>
        <span className="faint num" style={{ fontSize: 11 }}>tier</span>
        {[1, 2, 3, 4].map((t) => (
          <button
            key={t}
            disabled={busy}
            onClick={() => act(item.item_id, { action: "edit_tier", tier: t })}
            className="btn"
            style={{ minHeight: 26, padding: "2px 10px", fontSize: 12, background: item.content.fake_quality_tier === t ? "var(--panel-2)" : "transparent", border: `1px solid ${item.content.fake_quality_tier === t ? "var(--whiteblue)" : "var(--line)"}` }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* actions */}
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn btn-gold" style={{ flex: 1, minHeight: 40 }} disabled={busy} onClick={() => act(item.item_id, { action: "approve" })}>
          Approve
        </button>
        <button
          className="btn btn-ghost"
          style={{ flex: 1, minHeight: 40 }}
          disabled={busy}
          onClick={() => {
            const reason = window.prompt(`Reject ${item.item_id} — reason (logged):`, "");
            if (reason !== null) act(item.item_id, { action: "reject", reason });
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
