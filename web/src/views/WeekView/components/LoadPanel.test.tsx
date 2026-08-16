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

  it("carries the DATA state in the tooltip too", () => {
    /* `Data` left the day table on 2026-08-15 with the three other provenance
     * columns. Unlike them it also kept a place on the row -- in the score
     * cell -- but a reader hovering the bar must still be able to see it. */
    const w = week({ days: [day({ completeness: "partial-gap" })] });
    const { container } = wrap(<LoadPanel week={w} />);
    fireEvent.mouseEnter(container.querySelector("svg [role='listitem']")!, {
      clientX: 1,
      clientY: 1,
    });
    expect(container.querySelector(".tooltip")!.textContent).toContain(
      "partial-gap",
    );
  });

  it("carries the ROLE in the tooltip", () => {
    const w = week({ days: [day({ role: "recovery" })] });
    const { container } = wrap(<LoadPanel week={w} />);
    fireEvent.mouseEnter(container.querySelector("svg [role='listitem']")!, {
      clientX: 1,
      clientY: 1,
    });
    expect(container.querySelector(".tooltip")!.textContent).toContain(
      "recovery",
    );
  });

  const FULL = {
    ceiling_inputs: {
      cadence_spm: 175,
      cadence_source: "measured",
      default_cadence_spm: 172,
      run_step_weight: 2.5,
      background_steps: 1661,
      background_source: "baseline",
      background_window_days: 28,
      margin: 1.05,
    },
    readiness: { passed: 6, available: 7, per_day: [] },
    acwr_mech: 1.2,
  };

  it("assembles the card: chart, toggle, days, ceiling bullets and A:C", () => {
    const { container } = wrap(<LoadPanel week={week(FULL)} />);
    const text = container.textContent!;
    expect(text).toContain("prescribed run minutes");
    expect(text).toContain("Acute:chronic and load shape");
    // Two tables at rest -- the day table and the A:C table. Readiness is
    // behind the other tab.
    expect(container.querySelectorAll("table").length).toBe(2);
  });

  describe("the Steps / Readiness toggle", () => {
    /* Two tables answering different questions about the same seven days --
     * what the body was asked to do, and what it reported back overnight.
     * Stacked, reaching the second meant scrolling past the first. */

    const strip = (c: HTMLElement) => c.querySelector(".tabs")!;
    const tab = (c: HTMLElement, label: string) =>
      [...strip(c).querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").startsWith(label),
      )!;

    it("opens on the steps table", () => {
      const { container } = wrap(<LoadPanel week={week(FULL)} />);
      expect(tab(container, "Steps").getAttribute("aria-selected")).toBe("true");
      expect(container.querySelectorAll("thead th")[0].textContent).toBe("Day");
    });

    it("swaps the table when Readiness is chosen", () => {
      const { container } = wrap(<LoadPanel week={week(FULL)} />);
      fireEvent.click(tab(container, "Readiness"));
      const text = container.textContent!;
      expect(text).toContain("Resting HR");
      // The steps table and everything under it go with it.
      expect(text).not.toContain("prescribed run minutes");
      expect(text).not.toContain("Run TRIMP");
    });

    it("puts the readiness COUNT in the tab label", () => {
      /* `ReadinessTable`'s own `<h3>` carried it until 2026-08-15 and was
       * deleted as duplication -- but the count itself must survive, and in
       * the label it is legible without opening the panel at all. */
      const { container } = wrap(<LoadPanel week={week(FULL)} />);
      expect(tab(container, "Readiness").textContent).toBe("Readiness 6/7");
    });

    it("says just Readiness when the grader scored none", () => {
      const w = week({ ...FULL, readiness: null });
      const { container } = wrap(<LoadPanel week={w} />);
      expect(tab(container, "Readiness").textContent).toBe("Readiness");
    });

    it("wires the tabs to the panel they disclose", () => {
      // The accessibility half is the one nobody re-checks after copying, which
      // is why this uses the shared primitive rather than a second copy.
      const { container } = wrap(<LoadPanel week={week(FULL)} />);
      const id = tab(container, "Steps").getAttribute("aria-controls")!;
      expect(id).toBeTruthy();
      expect(container.querySelector(`#${id}`)!.getAttribute("role")).toBe(
        "tabpanel",
      );
    });

    it("marks the strip as a tablist with exactly two tabs", () => {
      const { container } = wrap(<LoadPanel week={week(FULL)} />);
      expect(strip(container).getAttribute("role")).toBe("tablist");
      expect(strip(container).querySelectorAll("button")).toHaveLength(2);
    });

    it("does not push itself to the far margin", () => {
      /* `.tabs` carries `margin-left: auto` for the three strips that sit
       * beside a title. This one stands on its own line above the table it
       * discloses, so it takes its own class. jsdom applies no CSS, so the
       * class is what can be asserted -- the rendering itself needs an eye. */
      const { container } = wrap(<LoadPanel week={week(FULL)} />);
      expect(strip(container).className).toContain("table-toggle");
    });
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
