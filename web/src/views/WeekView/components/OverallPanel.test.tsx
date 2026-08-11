import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithBoth } from "@/test/payload";
import { wrap } from "@/test/render";
import { OverallPanel } from "./OverallPanel";

afterEach(cleanup);

const found = PUBLISHED ? weekWithBoth(PUBLISHED) : null;

const week = (over: Partial<Week>): Week =>
  ({ week_start: "2026-07-27", ...over }) as Week;

const figures = (c: HTMLElement) =>
  [...c.querySelectorAll(".figure")].map((e) => e.textContent);

describe("OverallPanel", () => {
  has(found)("shows both hero figures as numbers, not dashes", () => {
    const [, w] = found!;
    const { container } = wrap(<OverallPanel week={w} />);
    expect(figures(container)).toHaveLength(2);
    for (const f of figures(container)) expect(f).toMatch(/^\d+$/);
  });

  it("shows TWO figures, never one combined score", () => {
    /* Adherence and load answer different questions off different instruments.
     * 2026-08-01 scores 99 on adherence and 51 on load, and an average of those
     * describes no day that happened. */
    const w = week({
      adherence: { scores: { week: { pct: 99 } } } as unknown as Week["adherence"],
      load: { overall: 51 } as unknown as Week["load"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    expect(figures(container)).toEqual(["99", "51"]);
  });

  it("shows a dash for a half that did not grade", () => {
    const w = week({
      adherence: { scores: { week: { pct: 90 } } } as unknown as Week["adherence"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    expect(figures(container)).toEqual(["90", "--"]);
  });

  it("shows a score of 0 rather than a dash", () => {
    // 0 is a real score; only absence is a dash.
    const w = week({
      adherence: { scores: { week: { pct: 0 } } } as unknown as Week["adherence"],
      load: { overall: 0 } as unknown as Week["load"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    expect(figures(container)).toEqual(["0", "0"]);
  });

  it("shows three adherence meters and two load meters when both graded", () => {
    const w = week({
      adherence: {
        scores: { week: { pct: 90 }, easy: { pct: 88 }, workout: { pct: 92 } },
        structure: { pct: 100, checks: {} },
      } as unknown as Week["adherence"],
      load: {
        overall: 80,
        integrity: { pct: 78 },
        readiness: { pct: 82 },
      } as unknown as Week["load"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    expect(container.querySelectorAll(".meter-row")).toHaveLength(5);
  });

  it("shows no load meters at all when load did not grade", () => {
    // Not a zeroed meter: an ungraded half is absent, not failing.
    const w = week({
      adherence: {
        scores: { week: { pct: 90 } },
        structure: { pct: 100, checks: {} },
      } as unknown as Week["adherence"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    const labels = [...container.querySelectorAll(".meter-row .label")].map(
      (l) => l.textContent,
    );
    expect(labels).not.toContain("Load integrity");
  });

  it("does not name the week -- the CARD does, above the tabs", () => {
    /* The title has to stay put while Training and Load swap in beneath it, so
     * it belongs to `WeekCard` and is asserted there. This panel's only h3 is
     * the one a score bar opens. */
    const { container } = wrap(<OverallPanel week={week({})} />);
    expect(container.textContent).not.toContain("Week of 2026-07-27");
  });

  it("no longer carries the unscored facts table", () => {
    /* Volume, the long run and the easy/quality split moved to the Runs card on
     * 2026-08-10 -- they are facts about the runs, and sitting under the score
     * bars they read as part of the grade. `Days` restated the runs table and
     * `Surface` reported author-typed strings as measurements; both are gone. */
    const [, w] = found ?? [null, week({})];
    const { container } = wrap(<OverallPanel week={w!} />);
    expect(container.textContent).not.toContain("Volume and structure");
    expect(container.textContent).not.toContain("Surface");
  });
});

describe("OverallPanel disclosure", () => {
  const graded = week({
    adherence: {
      scores: { week: { pct: 81 }, easy: { pct: 78 }, workout: { pct: 93 } },
      structure: { pct: 75, checks: { long_run_share: true } },
      results: [],
      flags: [
        { token: "consecutive-compromised", status: "clear", why: "1 of 2" },
      ],
    } as unknown as Week["adherence"],
    load: {
      overall: 95,
      integrity: { pct: 100 },
      readiness: { pct: 90 },
      days: [],
      flags: [],
    } as unknown as Week["load"],
  });

  const bars = (c: HTMLElement) =>
    [...c.querySelectorAll("button.meter-row")] as HTMLButtonElement[];
  const panel = (c: HTMLElement) => c.querySelector(".score-detail");

  it("makes every bar a button", () => {
    // The bars were decoration: five numbers with nothing saying which run,
    // which day or which check cost the points.
    const { container } = wrap(<OverallPanel week={graded} />);
    expect(bars(container)).toHaveLength(5);
  });

  it("opens nothing until a bar is clicked", () => {
    const { container } = wrap(<OverallPanel week={graded} />);
    expect(panel(container)).toBeNull();
  });

  it("opens the clicked score's panel", () => {
    const { container } = wrap(<OverallPanel week={graded} />);
    fireEvent.click(bars(container)[2]);
    expect(panel(container)!.querySelector("h3")!.textContent).toBe("Structure");
  });

  it("opens only ONE panel at a time", () => {
    // Five expanded panels is the wall of banners this page has been through.
    const { container } = wrap(<OverallPanel week={graded} />);
    fireEvent.click(bars(container)[0]);
    fireEvent.click(bars(container)[4]);
    expect(container.querySelectorAll(".score-detail")).toHaveLength(1);
    expect(panel(container)!.querySelector("h3")!.textContent).toBe("Readiness");
  });

  it("closes when the open bar is clicked again", () => {
    const { container } = wrap(<OverallPanel week={graded} />);
    fireEvent.click(bars(container)[0]);
    fireEvent.click(bars(container)[0]);
    expect(panel(container)).toBeNull();
  });

  it("reports the open bar through aria-expanded", () => {
    const { container } = wrap(<OverallPanel week={graded} />);
    fireEvent.click(bars(container)[1]);
    const states = bars(container).map((b) => b.getAttribute("aria-expanded"));
    expect(states).toEqual(["false", "true", "false", "false", "false"]);
  });

  it("shows the clicked score's flags inside the panel", () => {
    const { container } = wrap(<OverallPanel week={graded} />);
    fireEvent.click(bars(container)[1]);
    expect(panel(container)!.textContent).toContain("consecutive-compromised");
  });

  it("keeps another score's flags out of it", () => {
    const { container } = wrap(<OverallPanel week={graded} />);
    fireEvent.click(bars(container)[2]);
    expect(panel(container)!.textContent).not.toContain("consecutive-compromised");
  });

  it("surfaces a flag no component claims, rather than dropping it", () => {
    /* Placement decides visibility now that the Flags card is gone, so a grader
     * adding a token would otherwise drop it off the page entirely -- and a flag
     * nobody sees is worse than no flag, because the page reads as checked. */
    const w = week({
      adherence: {
        scores: { week: { pct: 80 } },
        flags: [{ token: "brand-new-flag", status: "fired", why: "surprise" }],
      } as unknown as Week["adherence"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    expect(container.querySelector(".unmapped")!.textContent).toContain(
      "brand-new-flag",
    );
  });

  has(found)("renders no unmapped block for a real published week", () => {
    const [, w] = found!;
    const { container } = wrap(<OverallPanel week={w} />);
    expect(container.querySelector(".unmapped")).toBeNull();
  });

  has(found)("the Structure panel carries every check, n/a included", () => {
    /* THIS IS WHAT REPLACES THE DELETED StructureCard. That card sat below this
     * one rendering the same four checks alphabetically in a table, months
     * after `structureLedger()` had absorbed them; the ledger is the better of
     * the two and it is where the score is, so the card went on 2026-08-10.
     *
     * `null` is a THIRD outcome -- not applicable, dropped from the
     * denominator. It must read as "n/a", never as a pass and never as blank:
     * showing it as a pass is the vacuous pass the structure score exists to
     * remove, and showing it blank reads as a rendering bug. */
    const [, w] = found!;
    const { container } = wrap(<OverallPanel week={w} />);
    const bar = bars(container).find(
      (b) => b.querySelector(".label")?.textContent === "Structure",
    )!;
    fireEvent.click(bar);

    const checks = w.adherence!.structure!.checks;
    const rows = [...panel(container)!.querySelectorAll(".loss:not(.is-total)")];
    expect(rows).toHaveLength(Object.keys(checks).length);

    const want = { pass: 0, fail: 0, na: 0 };
    for (const v of Object.values(checks)) {
      if (v === null) want.na += 1;
      else if (v) want.pass += 1;
      else want.fail += 1;
    }
    const text = rows.map((r) => r.textContent ?? "");
    expect(text.filter((t) => t.includes("n/a"))).toHaveLength(want.na);
    expect(text.filter((t) => t.includes("✓ pass"))).toHaveLength(want.pass);
    expect(text.filter((t) => t.includes("✗ fail"))).toHaveLength(want.fail);
  });

  it("reads a check's token as words, and states the numbers behind it", () => {
    // The other half of what the deleted card did. A boolean says a check
    // failed; it does not say a session ran 20 minutes against a 25-35 window.
    const w = week({
      adherence: {
        scores: { week: { pct: 80 } },
        structure: {
          pct: 100,
          checks: { long_run_share: true },
          why: { long_run_share: "the long run was 19.3% of the week's distance" },
        },
      } as unknown as Week["adherence"],
    });
    const { container } = wrap(<OverallPanel week={w} />);
    fireEvent.click(
      bars(container).find((b) => b.querySelector(".label")?.textContent === "Structure")!,
    );
    expect(panel(container)!.textContent).toContain("long run share");
    expect(panel(container)!.textContent).toContain("19.3%");
  });

  has(found)("every bar of a real week opens a panel with a headline", () => {
    const [, w] = found!;
    const { container } = wrap(<OverallPanel week={w} />);
    for (const [i] of bars(container).entries()) {
      fireEvent.click(bars(container)[i]);
      expect(panel(container)).toBeTruthy();
      expect(panel(container)!.querySelector("h3")!.textContent).toBeTruthy();
    }
  });
});
