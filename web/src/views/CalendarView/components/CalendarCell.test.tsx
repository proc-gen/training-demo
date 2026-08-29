import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { CalendarCell } from "./CalendarCell";

afterEach(cleanup);

const DATE = "2026-07-27";

const day = (over: Partial<Day>): Day =>
  ({
    date: DATE,
    total_steps: 15258,
    run_steps: 7000,
    nonrun_steps: 8258,
    ...over,
  }) as Day;

const meta = (over: Partial<LoadDay>): LoadDay =>
  ({ date: DATE, ...over }) as LoadDay;

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

const cell = (over: Partial<Parameters<typeof CalendarCell>[0]> = {}) =>
  wrap(
    <CalendarCell
      date={DATE}
      d={day({})}
      m={undefined}
      runs={[]}
      prescriptions={[]}
      maxSteps={20000}
      selected={false}
      onSelect={() => {}}
      {...over}
    />,
  );

const widths = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>(".cal-bar i")].map((i) =>
    parseFloat(i.style.width),
  );

const el = (c: HTMLElement) => c.querySelector(".cal-cell")!;

describe("CalendarCell", () => {
  it("shows the date and the step count", () => {
    const { container } = cell();
    expect(container.querySelector(".d")!.textContent).toBe("7/27");
    expect(container.querySelector(".v")!.textContent).toBe("15,258");
  });

  it("TAKES ITS DATE AS A PROP, not off the steps row", () => {
    /* A day the export has not covered -- every day of a week authored two
     * Mondays out -- has no steps row at all while still having a place in the
     * grid and a prescription to show. */
    const { container } = cell({ date: "2026-08-24", d: undefined });
    expect(container.querySelector(".d")!.textContent).toBe("8/24");
    expect(container.querySelector(".v")!.textContent).toBe("--");
  });

  it("splits the bar into run and background", () => {
    expect(widths(cell().container)).toHaveLength(2);
  });

  it("BARS NEVER EXCEED THE CELL", () => {
    // Scaled in steps against the busiest day, so no bar may exceed 100%.
    const total = widths(cell({ maxSteps: 15258 }).container).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.001);
  });

  it("clamps a day larger than the stated maximum", () => {
    const total = widths(cell({ maxSteps: 1000 }).container).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.001);
  });

  it("scales proportionally against the busiest day", () => {
    const { container } = cell({
      d: day({ total_steps: 10000, run_steps: 10000, nonrun_steps: 0 }),
    });
    expect(widths(container)[0]).toBeCloseTo(50, 6);
  });

  it("draws no bar segments for a day with no steps", () => {
    const { container } = cell({
      d: day({ total_steps: null, run_steps: null, nonrun_steps: null }),
    });
    expect(widths(container)).toHaveLength(0);
  });

  it("draws no bar at all for a date nothing measured", () => {
    expect(widths(cell({ d: undefined }).container)).toHaveLength(0);
  });

  it("OUTLINES a day only when it breached a measured ceiling", () => {
    const { container } = cell({ m: meta({ se: 20000, ceiling: 18000 }) });
    expect(el(container).className).toContain("over");
  });

  it("does not outline a day the plan never priced", () => {
    const { container } = cell({ m: meta({ se: 20000, ceiling: null }) });
    expect(el(container).className).not.toContain("over");
  });

  it("does not outline an ungraded day", () => {
    expect(el(cell().container).className).not.toContain("over");
  });
});

describe("CalendarCell, the plan", () => {
  it("shows what the day was FOR, one line per run", () => {
    const { container } = cell({
      runs: [run({}), run({})],
      prescriptions: ["12x600m w/ 200m jog", "30 min recovery"],
    });
    const lines = [...container.querySelectorAll(".cal-plan i")].map((i) => i.textContent);
    expect(lines).toEqual(["12x600m w/ 200m jog", "30 min recovery"]);
  });

  it("shows no plan block at all on a day the manifest does not mention", () => {
    expect(cell().container.querySelector(".cal-plan")).toBeNull();
  });

  it("skips an empty prescription rather than rendering a blank line", () => {
    const { container } = cell({ runs: [run({}), run({})], prescriptions: ["", "easy"] });
    expect(container.querySelectorAll(".cal-plan i")).toHaveLength(1);
  });
});

describe("CalendarCell, the score", () => {
  it("shows each run's OWN percentage, never a day average", () => {
    /* Averaging would be a scoring rule invented in the browser, and `roll_up`
     * weights by seconds rather than by run -- so the browser's number would be
     * a different quantity wearing the same name. */
    const { container } = cell({
      runs: [run({ pct: 100 }), run({ pct: 78 })],
      prescriptions: ["", ""],
    });
    expect(container.querySelector(".cal-scores")!.textContent).toContain("100%");
    expect(container.querySelector(".cal-scores")!.textContent).toContain("78%");
  });

  it("prints a run that landed exactly on its prescription", () => {
    // 0 is a real score and is falsy; filtering on truthiness once hid every
    // run that was bang on.
    const { container } = cell({ runs: [run({ pct: 0 })], prescriptions: [""] });
    expect(container.querySelector(".cal-scores")!.textContent).toContain("0%");
  });

  it("dashes a completed run the grader could not score", () => {
    const { container } = cell({ runs: [run({ pct: null })], prescriptions: [""] });
    expect(container.querySelector(".cal-scores")!.textContent).toBe("--");
  });

  it("says NOT YET COMPLETED for a pending run, in the grader's own words", () => {
    // The GRADER resolved the status; the page reads no clock.
    const { container } = cell({
      runs: [run({ status: "pending" })],
      prescriptions: ["30 min recovery"],
    });
    expect(container.querySelector(".cal-scores")!.textContent).toBe("Not yet completed");
  });

  it("says MISSED for a run whose day is over, which is a different thing", () => {
    const { container } = cell({
      runs: [run({ status: "missed" })],
      prescriptions: ["30 min recovery"],
    });
    expect(container.querySelector(".cal-scores")!.textContent).toBe("Missed");
  });

  it("shows no score block on a day with no runs", () => {
    expect(cell().container.querySelector(".cal-scores")).toBeNull();
  });
});

describe("CalendarCell, the tint", () => {
  it("is untinted for an easy day", () => {
    const c = el(cell({ runs: [run({ emphasis: [] })] }).container) as HTMLElement;
    expect(c.className).not.toContain("emph-");
    expect(c.style.background).toBe("");
  });

  it("names its tint in a class and paints it from a variable", () => {
    const c = el(
      cell({ runs: [run({ emphasis: ["quality"] })], prescriptions: [""] }).container,
    ) as HTMLElement;
    expect(c.className).toContain("emph-quality");
    expect(c.style.background).toContain("--tint-quality");
  });

  it("SPLITS a day that is two things", () => {
    const c = el(
      cell({ runs: [run({ emphasis: ["long", "quality"] })], prescriptions: [""] })
        .container,
    ) as HTMLElement;
    expect(c.className).toContain("emph-long");
    expect(c.className).toContain("emph-quality");
    expect(c.style.background).toContain("linear-gradient");
  });

  it("unions the day's runs rather than taking the first", () => {
    const c = el(
      cell({
        runs: [run({ emphasis: [] }), run({ emphasis: ["quality"] })],
        prescriptions: ["", ""],
      }).container,
    ) as HTMLElement;
    expect(c.className).toContain("emph-quality");
  });

  it("SAYS THE TINT IN WORDS, so colour is never the only channel", () => {
    const c = el(
      cell({
        runs: [run({ emphasis: ["long"] })],
        prescriptions: ["90 min easy/long"],
      }).container,
    );
    const label = c.getAttribute("aria-label")!;
    expect(label).toContain("long run");
    expect(label).toContain("90 min easy/long");
    expect(label).toContain("2026-07-27");
  });
});

describe("CalendarCell, selection", () => {
  it("IS A REAL BUTTON, so it is reachable by keyboard", () => {
    // The bare clickable `<tr>` in RunRow is named in CLAUDE.md as a gap, not a
    // pattern to copy.
    expect(el(cell().container).tagName).toBe("BUTTON");
  });

  it("reports whether it is the selected day", () => {
    expect(el(cell().container).getAttribute("aria-pressed")).toBe("false");
    const { container } = cell({ selected: true });
    expect(el(container).getAttribute("aria-pressed")).toBe("true");
    expect(el(container).className).toContain("is-selected");
  });

  it("calls back on click", () => {
    const onSelect = vi.fn();
    const { container } = cell({ onSelect });
    fireEvent.click(el(container));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarCell, the tooltip", () => {
  const hover = (c: HTMLElement) =>
    fireEvent.mouseEnter(el(c), { clientX: 1, clientY: 1 });

  it("carries the SE breakdown and its PROVENANCE when the day was graded", () => {
    const { container } = cell({
      m: meta({
        se: 19000, run_se: 17500, nonrun_se: 1500, ceiling: 18000,
        role: "easy", ceiling_source: "prescribed",
        run_step_source: "cadence-measured", completeness: "full",
      }),
    });
    hover(container);
    const tip = container.querySelector(".tooltip")!;
    expect(tip.textContent).toContain("easy");
    expect(tip.textContent).toContain("19,000");
    expect(tip.textContent).toContain("18,000");
    expect(tip.textContent).toContain("prescribed");
    expect(tip.textContent).toContain("cadence-measured");
  });

  it("names the session type", () => {
    const { container } = cell({ runs: [run({ emphasis: ["race"] })] });
    hover(container);
    expect(container.querySelector(".tooltip")!.textContent).toContain("race");
  });

  it("omits the SE rows for an ungraded day rather than showing dashes", () => {
    const { container } = cell();
    hover(container);
    expect(container.querySelector(".tooltip")!.textContent).not.toContain("day SE");
  });

  it("is focusable, so the tooltip is not the only route to the value", () => {
    expect(el(cell().container).getAttribute("tabindex")).toBe("0");
  });
});
