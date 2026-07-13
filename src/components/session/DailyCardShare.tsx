// Daily card + share flow (BUILD PROMPT Section 11). navigator.share with the
// image file; fallback = copy image + copy link. Spoiler-free by construction.
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client/api";
import { track } from "@/lib/client/track";
import type { CardData } from "@/lib/card";

export function DailyCardShare({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [card, setCard] = useState<CardData | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const shareId = useMemo(
    () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)),
    []
  );

  useEffect(() => {
    api<CardData>(`/api/card/${sessionId}`)
      .then((c) => {
        setCard(c);
        track("card_generated", { session: sessionId });
      })
      .catch(() => setCard(null));
  }, [sessionId]);

  const version = card?.contentHash ?? "0";
  const ogUrl = `/api/og/daily/${sessionId}?v=${version}&s=${shareId}`;
  const base = (typeof window !== "undefined" && window.location.origin) || "";
  const shareUrl = `${base}/?v=${version}&s=${shareId}`;

  async function share() {
    try {
      const blob = await fetch(ogUrl).then((r) => r.blob());
      const file = new File([blob], "mindprint.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], text: "My Mind Print today", url: shareUrl });
        track("card_shared", { method: "native", card_version: version });
        return;
      }
      // Fallback: copy image + copy link.
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      } catch {
        /* image copy may be unsupported */
      }
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setStatus("Copied image + link");
      track("card_shared", { method: "copy", card_version: version });
    } catch {
      await navigator.clipboard?.writeText(shareUrl).catch(() => {});
      setStatus("Copied link");
      track("card_shared", { method: "link", card_version: version });
    }
  }

  return (
    <div className="screen center">
      <p className="kicker" style={{ marginBottom: 12 }}>Today&apos;s card</p>
      <div
        className="card"
        style={{ padding: 0, overflow: "hidden", width: "100%", maxWidth: 340, aspectRatio: "1", background: "var(--field-2)" }}
      >
        {/* Preview uses the same OG image the share sends. */}
        <img src={ogUrl} alt="Your daily Mind Print card" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {status ? <p className="calib" style={{ marginTop: 12 }}>{status}</p> : null}

      <div className="grow" />
      <button className="btn btn-gold" onClick={share}>Share</button>
      <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onDone}>Done</button>
      {/* open-loop line */}
      <p className="faint center" style={{ fontSize: 13, marginTop: 16 }}>
        Come back tomorrow — the fog moves overnight.
      </p>
    </div>
  );
}
