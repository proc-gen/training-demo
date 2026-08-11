import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LoadDay, Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithLoad } from "@/test/payload";
import { wrap } from "@/test/render";
import { LoadPanel } from "./LoadPanel";

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
    run_step_source: "window",
    completeness: "full",
    scored: true,
    pct: 100,
    ...over,
  }) as LoadDay;

const week = (over: Record<string, unknown>): Week =>
  ({ load: { days: [day({})], ...over } }) as unknown as Week;

describe("LoadPanel", () => {
  it("names its three colours", () => {
    const { container } = wrap(<LoadPanel week={week({})} />);
    expect(container.querySelectorAll(".legend-item")).toHaveLength(3);
  });

  it("draws one chart group per day", () => {
    const w = week({ days: [day({}), day({ date: "2026-07-28" })] });
    const { container } = wrap(<LoadPanel week={w} />);
    expect(container.querySelectorAll("svg [role='listitem']")).toHaveLength(2);
  });

  it("carries the full breakdown in a day's tooltip", () => {
    const { container } = wrap(<LoadPanel week={week({})} />);
    fireEvent.mouseEnter(container.querySelector("svg [role='listitem']")!, {
      clientX: 1,
      clientY: 1,
    });
    const tip = container.querySelector(".tooltip")!.textContent!;
    expect(tip).toContain("12,000");
    expect(tip).toContain("3,000");
    expect(tip).toContain("18,000");
    expect(tip).toContain("prescribed");
  });

  it("says UNPRICED in the tooltip for a day the plan did not price", () => {
    const w = week({ days: [day({ ceiling_source: null, ceiling: null })] });
    const { container } = wrap(<LoadPanel week={w} />);
    fireEvent.mouseEnter(container.querySelector("svg [role='listitem']")!, {
      clientX: 1,
      clientY: 1,
    });
    expect(container.querySelector(".tooltip")!.textContent).toContain("unpriced");
  });

  it("assembles the whole card: chart, formula, days, readiness and A:C", () => {
    const w = week({
      ceiling_inputs: {
        cadence_spm: 175,
        cadence_source: "measured",
        run_step_weight: 2.5,
        background_steps: 1661,
        background_source: "derived",
        margin: 1.05,
      },
      readiness: { passed: 6, available: 7, per_day: [] },
      acwr_mech: 1.2,
    });
    const { container } = wrap(<LoadPanel week={w} />);
    const text = container.textContent!;
    expect(text).toContain("prescribed run minutes");
    expect(text).toContain("Readiness");
    expect(text).toContain("Acute:chronic and load shape");
    expect(container.querySelectorAll("table").length).toBe(3);
  });

  it("renders without a chart group when the grader returned no days", () => {
    const { container } = wrap(<LoadPanel week={week({ days: [] })} />);
    expect(container.querySelectorAll("svg [role='listitem']")).toHaveLength(0);
    expect(container.querySelector("svg.chart")).toBeTruthy();
  });

  has(found)("renders a per-day load row for every day the grader returned", () => {
    const [, w] = found!;
    const { container } = wrap(<LoadPanel week={w} />);
    const groups = container.querySelectorAll("svg [role='listitem']");
    expect(groups.length).toBe(w.load!.days.length);
  });

  has(found)("keeps every mark inside the plot", () => {
    // A ceiling above the top tick once drew a red rule across the legend.
    const [, w] = found!;
    const { container } = wrap(<LoadPanel week={w} />);
    const svg = container.querySelector("svg.chart")!;
    const h = Number(svg.getAttribute("viewBox")!.split(" ")[3]);
    for (const el of svg.querySelectorAll("rect, line")) {
      for (const attr of ["y", "y1", "y2"]) {
        const v = el.getAttribute(attr);
        if (v === null) continue;
        expect(parseFloat(v)).toBeGreaterThanOrEqual(-0.001);
        expect(parseFloat(v)).toBeLessThanOrEqual(h + 0.001);
      }
    }
  });
});
