// Star economy rules (BUILD PROMPT Section 5).
import { describe, expect, it } from "vitest";
import { applyStars, beatsBaseline, median, resolveWager } from "@/lib/engine/wager";

describe("wager resolution", () => {
  it("win pays +stake", () => {
    const r = resolveWager({ stake: 3, success: true, baselineBuilding: false });
    expect(r).toMatchObject({ outcome: "won", starDelta: 3, calibrationCredit: 0, glint: false });
  });

  it("loss costs -stake", () => {
    const r = resolveWager({ stake: 2, success: false, baselineBuilding: false });
    expect(r).toMatchObject({ outcome: "lost", starDelta: -2 });
  });

  it("accurate low bet (staked 1, lost) earns +0.5 calibration credit and glints", () => {
    const r = resolveWager({ stake: 1, success: false, baselineBuilding: false });
    expect(r).toMatchObject({ outcome: "lost", starDelta: -1, calibrationCredit: 0.5, glint: true });
  });

  it("first runs auto-succeed as baseline_building", () => {
    const r = resolveWager({ stake: 2, success: false, baselineBuilding: true });
    expect(r).toMatchObject({ outcome: "baseline_building", starDelta: 2 });
  });

  it("visible balance floors at 0", () => {
    expect(applyStars(1, -3)).toBe(0);
    expect(applyStars(5, -3)).toBe(2);
  });
});

describe("baseline comparison", () => {
  it("median of last 5", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("respects lower-is-better metrics", () => {
    expect(beatsBaseline(400, 500, true)).toBe(true); // faster RT wins
    expect(beatsBaseline(600, 500, true)).toBe(false);
    expect(beatsBaseline(80, 70, false)).toBe(true); // higher accuracy wins
  });
});
