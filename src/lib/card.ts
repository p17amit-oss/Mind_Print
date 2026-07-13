// Daily card data model (BUILD PROMPT Section 11). Spoiler-free by construction:
// abstract result bars, wager stars + outcome, never raw scores.
import { createHash } from "node:crypto";

export interface CardTrial {
  trial: string;
  title: string;
  /** abstract 0..1 bar derived from outcome+stake — NOT a raw score. */
  bar: number;
  stake: number;
  outcome: "won" | "lost" | "baseline_building" | null;
}

export interface CardData {
  sessionId: string;
  date: string;
  resolutionPct: number;
  trials: CardTrial[];
  formLine: string | null;
  fooledLine: string | null;
  contentHash: string;
}

/** Outcome → abstract bar (spoiler-free; never exposes the underlying metric). */
export function outcomeBar(outcome: string | null, stake: number): number {
  const base = outcome === "won" ? 0.82 : outcome === "baseline_building" ? 0.62 : 0.36;
  return Math.min(1, base + (stake - 2) * 0.05);
}

export function hashCard(d: Omit<CardData, "contentHash">): string {
  return createHash("sha1").update(JSON.stringify(d)).digest("hex").slice(0, 16);
}
