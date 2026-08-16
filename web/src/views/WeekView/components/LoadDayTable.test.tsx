import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LoadDay } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithLoad } from "@/test/payload";
import { wrap } from "@/test/render";
import { LoadDayTable } from "./LoadDayTable";

afterEach(cleanup);

const found = PUBLISHED ? weekWithLoad(PUBLISHED) : null;

const day = (over: Partial<LoadDay>): LoadDay =>
  ({
    date: "2026-07-27",
    role: "easy",
    total_steps: 15258,
    run_se: 12000,
    nonrun_se: 3000,
    se: 15000,
    ceiling: 18000,
    ceiling_source: "prescribed",
    prescribed_run_seconds: 2700,
    run_step_source: "window",
    completeness: "full",
    scored: true,
    pct: 100,
    trimp: 88.6,
    bg_trimp: 3.9,
    bg_trimp_hr_rest_source: "measured",
    ctl: 82,
    atl: 88,
    tsb: -6,
    ...over,
  }) as LoadDay;

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];
const cells = (c: HTMLElement, i = 0) =>
  [...rows(c)[i].querySelectorAll("td")].map((t) => t.textContent);
const headers = (c: HTMLElement) =>
  [...c.querySelectorAll("thead th")].map((t) => t.textContent);

describe("LoadDayTable", () => {
  it("renders a row per day", () => {
    const { container } = wrap(
      <LoadDayTable days={[day({}), day({ date: "2026-07-28" })]} />,
    );
    expect(rows(container)).toHaveLength(2);
  });

  it("shows the run/background split, not just a total", () => {
    // A day over because the session ran long and a day over because of a hike
    // produce the same number and call for opposite responses.
    const { container } = wrap(<LoadDayTable days={[day({})]} />);
    expect(cells(container)).toContain("12,000");
    expect(cells(container)).toContain("3,000");
  });

  it("shows what the day was PRESCRIBED to cost, in minutes", () => {
    // The input the ceiling beside it is built from.
    const { container } = wrap(
      <LoadDayTable days={[day({ prescribed_run_seconds: 2700 })]} />,
    );
    expect(cells(container)).toContain("45m");
  });

  it.each([null, undefined])("shows -- when the prescription is %s", (v) => {
    const { container } = wrap(
      <LoadDayTable days={[day({ prescribed_run_seconds: v })]} />,
    );
    expect(cells(container)).toContain("--");
  });

  it("shows a prescribed 0 as 0m, not as absent", () => {
    // A rest day is prescribed zero running minutes; its ceiling is the
    // background allowance alone, which is a real number.
    const { container } = wrap(
      <LoadDayTable days={[day({ prescribed_run_seconds: 0, role: "rest" })]} />,
    );
    expect(cells(container)).toContain("0m");
  });

  describe("the training-state columns", () => {
    /* They were a four-row table at the foot of the tab until 2026-08-15,
     * showing ONE of each for the whole week -- while the grader had stamped
     * all four onto every day record all along. */

    it("carries the day's own TRIMP and curve", () => {
      const { container } = wrap(<LoadDayTable days={[day({})]} />);
      expect(headers(container)).toEqual(
        expect.arrayContaining(["Run TRIMP", "Bg TRIMP", "CTL", "ATL", "TSB"]),
      );
      expect(cells(container)).toContain("88.6");
      expect(cells(container)).toContain("82");
    });

    it("SIGNS the form column", () => {
      // TSB is a balance, read by its direction before its magnitude: +3 and
      // -3 are opposite states and `3` says neither.
      const { container } = wrap(<LoadDayTable days={[day({ tsb: -6 })]} />);
      expect(cells(container)).toContain("-6");
      const plus = wrap(<LoadDayTable days={[day({ tsb: 6 })]} />);
      expect(cells(plus.container)).toContain("+6");
    });

    it("signs a zero balance too", () => {
      // Fitness exactly equal to fatigue is a real state, and dropping the sign
      // there makes the one neutral value look like a different kind of number.
      const { container } = wrap(<LoadDayTable days={[day({ tsb: 0 })]} />);
      expect(cells(container)).toContain("+0");
    });

    it("shows -- where the TRIMP series does not reach the day", () => {
      const { container } = wrap(
        <LoadDayTable
          days={[
            day({ trimp: null, ctl: null, atl: null, tsb: null, bg_trimp: null }),
          ]}
        />,
      );
      const c = cells(container);
      expect(c.filter((t) => t === "--").length).toBeGreaterThanOrEqual(5);
    });

    it("shows a background TRIMP of ZERO as a measurement", () => {
      // 0 is a day nobody moved. `0` is falsy, and collapsing it into `--`
      // would report a measured day as an unmeasured one.
      const { container } = wrap(<LoadDayTable days={[day({ bg_trimp: 0 })]} />);
      expect(cells(container)).toContain("0.0");
      expect(cells(container)).not.toContain("--");
    });

    it("keeps background TRIMP in its own column", () => {
      /* It is an UNCALIBRATED estimate sitting beside a measurement integrated
       * from heart rate. Folding the two into one number would make them
       * indistinguishable in the one place a reader compares them. */
      const { container } = wrap(<LoadDayTable days={[day({})]} />);
      const h = headers(container);
      expect(h.indexOf("Bg TRIMP")).toBe(h.indexOf("Run TRIMP") + 1);
      expect(cells(container)).toContain("3.9");
      expect(cells(container)).toContain("88.6");
    });
  });

  describe("an unscored day says WHY, in the score cell", () => {
    /* The `Data` column left the table on 2026-08-15 with the three other
     * provenance columns. This is the one fact it carried that a tooltip could
     * not hold: a bare `--` in the score cell reads as a zero. */

    it("names the completeness state", () => {
      const { container } = wrap(
        <LoadDayTable
          days={[day({ scored: false, pct: null, completeness: "in-progress" })]}
        />,
      );
      expect(cells(container)).toContain("in-progress");
    });

    it("distinguishes an UNPRICED day from an uncovered one", () => {
      /* Two completely different problems: the export covered this day
       * perfectly well and the PLAN did not state a duration for every run on
       * it. Reading `full` there would be true and useless. */
      const { container } = wrap(
        <LoadDayTable
          days={[
            day({ scored: false, pct: null, ceiling: null, completeness: "full" }),
          ]}
        />,
      );
      expect(cells(container)).toContain("unpriced");
      expect(cells(container)).not.toContain("full");
    });

    it("marks the reason as a warning", () => {
      const { container } = wrap(
        <LoadDayTable
          days={[day({ scored: false, pct: null, completeness: "partial-gap" })]}
        />,
      );
      expect(
        container.querySelector("tbody tr td span.warn")!.textContent,
      ).toBe("partial-gap");
    });

    it("shows the score and a severity dot on a day that WAS scored", () => {
      const { container } = wrap(<LoadDayTable days={[day({ pct: 83 })]} />);
      expect(rows(container)[0].textContent).toContain("83%");
      expect(container.querySelector("tbody .dot")).not.toBeNull();
      expect(container.querySelector("tbody td span.warn")).toBeNull();
    });

    it("shows a perfect 0.0 deviation rather than hiding it", () => {
      // 0 is falsy and pct 0 is a real, terrible score.
      const { container } = wrap(<LoadDayTable days={[day({ pct: 0 })]} />);
      expect(rows(container)[0].textContent).toContain("0%");
    });
  });

  describe("the four provenance columns are GONE", () => {
    /* Within one week those strings barely vary, so four of twelve columns
     * were spent on them. They are not deleted -- `LoadPanel` carries all four
     * in the chart's tooltip, where a fact that qualifies rather than measures
     * belongs, and its own test pins that. */
    it.each(["Role", "Ceiling from", "Run steps from", "Data"])(
      "no %s column",
      (label) => {
        const { container } = wrap(<LoadDayTable days={[day({})]} />);
        expect(headers(container)).not.toContain(label);
      },
    );

    it("does not print the role or the ceiling tier in a cell either", () => {
      const { container } = wrap(
        <LoadDayTable days={[day({ role: "recovery", ceiling_source: "structure" })]} />,
      );
      expect(cells(container)).not.toContain("recovery");
      expect(cells(container)).not.toContain("structure");
    });
  });

  has(found)("renders every day of a real week", () => {
    const [, w] = found!;
    const { container } = wrap(<LoadDayTable days={w.load!.days} />);
    expect(rows(container)).toHaveLength(w.load!.days.length);
  });

  has(found)("prices the background of every covered day of a real week", () => {
    /* The experiment is only interesting if it actually lands on the real
     * tree: a column of dashes would pass every fixture test above. */
    const [, w] = found!;
    const covered = w.load!.days.filter((d) => d.nonrun_se != null);
    if (!covered.length) return;
    expect(covered.every((d) => d.bg_trimp != null)).toBe(true);
    const { container } = wrap(<LoadDayTable days={w.load!.days} />);
    expect(container.textContent).toContain(covered[0].bg_trimp!.toFixed(1));
  });
});
