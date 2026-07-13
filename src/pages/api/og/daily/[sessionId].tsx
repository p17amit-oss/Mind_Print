/* eslint-disable @next/next/no-img-element */
// GET /api/og/daily/[sessionId] — 1080×1080 daily share card (BUILD PROMPT
// Section 11). Spoiler-free: abstract result bars, wager stars + outcome, never
// raw scores. Cached by content-hash (URL carries ?v=<hash>).
import { ImageResponse } from "@vercel/og";
import type { CardData } from "@/lib/card";

export const config = { runtime: "edge" };

const FIELD = "#0a1020";
const GOLD = "#f5c451";
const TEAL = "#35d6c3";
const WHITEBLUE = "#bcd4ff";
const DIM = "#93a0c7";

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.pathname.split("/").pop() || "";
  let card: CardData | null = null;
  try {
    const r = await fetch(`${url.origin}/api/card/${sessionId}`);
    if (r.ok) card = (await r.json()) as CardData;
  } catch {
    card = null;
  }

  const trials = card?.trials ?? [];
  const dots = Array.from({ length: 8 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          background: FIELD,
          padding: "72px",
          color: "#e9eeff",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, letterSpacing: 8, color: DIM }}>MIND PRINT</div>
            <div style={{ fontSize: 26, color: DIM, marginTop: 8 }}>{card?.date ?? ""}</div>
          </div>
          <div style={{ display: "flex", fontSize: 40, color: WHITEBLUE }}>
            {card ? `${card.resolutionPct}% resolved` : ""}
          </div>
        </div>

        {/* trial rows */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 70, gap: 34 }}>
          {trials.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: "#1b2650",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  color: WHITEBLUE,
                }}
              >
                {t.title.slice(0, 1)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 32 }}>{t.title}</div>
                  <div style={{ display: "flex", fontSize: 30, color: GOLD }}>
                    {"★".repeat(t.stake)}
                    <span style={{ color: t.outcome === "lost" ? "#ff4d5e" : TEAL, marginLeft: 16, fontSize: 26 }}>
                      {t.outcome === "won" ? "won" : t.outcome === "lost" ? "lost" : "building"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", height: 18, background: "#243059", borderRadius: 9 }}>
                  <div style={{ display: "flex", width: `${Math.round(t.bar * 100)}%`, background: WHITEBLUE, borderRadius: 9 }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* constellation thumbnail (ring of dots) */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 60, position: "relative", height: 240 }}>
          {dots.map((_, i) => {
            const a = (-90 + 45 * i) * (Math.PI / 180);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 540 - 72 + Math.cos(a) * 100,
                  top: 120 + Math.sin(a) * 100,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: WHITEBLUE,
                  opacity: 0.6,
                }}
              />
            );
          })}
        </div>

        {/* footer lines */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", gap: 12 }}>
          {card?.formLine ? <div style={{ display: "flex", fontSize: 34, color: TEAL }}>{card.formLine}</div> : null}
          {card?.fooledLine ? <div style={{ display: "flex", fontSize: 32, color: "#ff4d5e" }}>{card.fooledLine}</div> : null}
          <div style={{ display: "flex", fontSize: 26, color: DIM, marginTop: 8 }}>mindprint.game</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=31536000",
        ...(card ? { ETag: `"${card.contentHash}"` } : {}),
      },
    }
  );
}
