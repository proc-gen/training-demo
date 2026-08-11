import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithBoth } from "@/test/payload";
import { wrap } from "@/test/render";
import { SCORE_COMPONENTS, componentByKey } from "../data/scoreComponents";
import { ScoreDetail } from "./ScoreDetail";

afterEach(cleanup);

const found = PUBLISHED ? weekWithBoth(PUBLISHED) : null;
const week = (over: unknown): Week => over as Week;

const structure = componentByKey("structure")!;

const w = week({
  adherence: {
    structure: {
      pct: 75,
      checks: { long_run_share: true, rest_days_met: null, session_work_volume: false },
      why: { session_work_volume: "2026-08-07 ran 20 min of work" },
    },
    flags: [{ token: "consecutive-compromised", status: "clear", why: "1 of 2" }],
  },
});

describe("ScoreDetail", () => {
  it("names the score it explains", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    expect(container.querySelector("h3")!.textContent).toBe("Structure");
  });

  it("carries the id the bar points at", () => {
    // The meter is a button with aria-controls; a dangling reference is worse
    // than none, because a screen reader announces a relationship that is not
    // there.
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    expect(container.querySelector(".score-detail")!.id).toBe("p");
  });

  it("states the arithmetic as the LAST row, not as a headline", () => {
    /* It sat above the ledger until 2026-08-10, where it read as a title rather
     * than as what it is -- the sum of the lines beneath it. Two of the three
     * checks apply; `rest_days_met` is null and left the denominator rather
     * than passing for free. */
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    const rows = [...container.querySelectorAll(".loss")];
    const last = rows[rows.length - 1];
    expect(last.className).toContain("is-total");
    expect(last.textContent).toContain("1 of 2 applicable checks passed");
    expect(container.querySelector(".headline")).toBeNull();
  });

  it("puts the component's own score in the contributors' column", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    const total = container.querySelector(".loss.is-total")!;
    expect(total.querySelector(".verdict")!.textContent).toBe("75%");
  });

  it("puts the note BELOW the total, since it qualifies that denominator", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    const kids = [...container.querySelector(".score-detail")!.children];
    const losses = kids.findIndex((e) => e.classList.contains("losses"));
    const note = kids.findLastIndex((e) => e.classList.contains("note"));
    expect(losses).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(losses);
  });

  it("says what the ratio counts", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    expect(container.textContent).toContain("leaves the denominator");
  });

  it("shows the grader's own reason for each check", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    expect(container.textContent).toContain("2026-08-07 ran 20 min of work");
  });

  it("says what it left out and why, never truncating silently", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    expect(container.textContent).toContain("did not apply");
  });

  it("ends with the flags that qualify the same score", () => {
    const { container } = wrap(<ScoreDetail week={w} component={structure} id="p" />);
    expect(container.textContent).toContain("No flag is evaluated");
  });

  it("renders the total alone when there is no contributor to list", () => {
    // A week with no checks at all still states what it summed, and says it
    // summed nothing -- an empty panel reads as a component nobody graded.
    const bare = week({ adherence: { structure: { checks: {} } } });
    const { container } = wrap(<ScoreDetail week={bare} component={structure} id="p" />);
    const rows = [...container.querySelectorAll(".loss")];
    expect(rows).toHaveLength(1);
    expect(rows[0].className).toContain("is-total");
    expect(rows[0].textContent).toContain("no check applied to this week");
  });

  describe("against the real published payload", () => {
    for (const c of SCORE_COMPONENTS)
      has(found)(`${c.key} ends on its totals row`, () => {
        const [, real] = found!;
        const { container } = wrap(<ScoreDetail week={real} component={c} id="p" />);
        expect(container.querySelector("h3")!.textContent).toBe(c.label);
        expect(container.textContent).toContain("Flags");
        const rows = [...container.querySelectorAll(".loss")];
        expect(rows[rows.length - 1].className).toContain("is-total");
      });
  });
});
