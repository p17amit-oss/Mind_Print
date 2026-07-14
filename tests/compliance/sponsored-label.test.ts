// Compliance: sponsored read_room items MUST render the Sponsored label
// (BUILD PROMPT Section 13). Renders the component and asserts the label.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadRoom } from "@/components/trials/ReadRoom";
import type { RoomStandardItem } from "@/lib/trials/roombank";

const sponsoredItem: RoomStandardItem = {
  item_id: "rr_sponsored_test",
  category: "aesthetic",
  prompt: "Which color?",
  options: ["A", "B", "C", "D"],
  distribution: [10, 20, 30, 40],
  sponsor: "acme",
};

const plainItem: RoomStandardItem = { ...sponsoredItem, item_id: "rr_plain_test", sponsor: null };

describe("Sponsored label", () => {
  it("renders 'Sponsored' when item.sponsor is set", () => {
    const html = renderToStaticMarkup(
      createElement(ReadRoom, {
        chaos: false,
        difficulty: {},
        items: [sponsoredItem],
        onComplete: () => {},
      })
    );
    expect(html).toContain("Sponsored");
  });

  it("does not render 'Sponsored' otherwise", () => {
    const html = renderToStaticMarkup(
      createElement(ReadRoom, {
        chaos: false,
        difficulty: {},
        items: [plainItem],
        onComplete: () => {},
      })
    );
    expect(html).not.toContain("Sponsored");
  });
});
