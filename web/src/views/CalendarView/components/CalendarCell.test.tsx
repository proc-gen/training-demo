import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Day, LoadDay } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { CalendarCell } from "./CalendarCell";

afterEach(cleanup);

const day = (over: Record<string, string>): Day =>
  ({
    date: "2026-07-27",
    total_steps: "15258",
    run_steps: "7000",
    nonrun_steps: "8258",
    ...over,
  }) as Day;

const meta = (over: Partial<LoadDay>): LoadDay =>
  ({ date: "2026-07-27", ...over }) as LoadDay;

const widths = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>(".cal-bar i")].map((i) =>
    parseFloat(i.style.width),
  );

describe("CalendarCell", () => {
  it("shows the date and the step count", () => {
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={20000} />);
    expect(container.querySelector(".d")!.textContent).toBe("7/27");
    expect(container.querySelector(".v")!.textContent).toBe("15,258");
  });

  it("splits the bar into run and background", () => {
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={20000} />);
    expect(widths(container)).toHaveLength(2);
  });

  it("BARS NEVER EXCEED THE CELL", () => {
    // Scaled in steps against the busiest day, so no bar may exceed 100%.
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={15258} />);
    const total = widths(container).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.001);
  });

  it("clamps a day larger than the stated maximum", () => {
    // Defensive: a maxSteps computed over a different set than the cell's day
    // would otherwise draw past the cell.
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={1000} />);
    expect(widths(container).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(100.001);
  });

  it("scales proportionally against the busiest day", () => {
    const { container } = wrap(
      <CalendarCell
        d={day({ total_steps: "10000", run_steps: "10000", nonrun_steps: "0" })}
        m={undefined}
        maxSteps={20000}
      />,
    );
    expect(widths(container)[0]).toBeCloseTo(50, 6);
  });

  it("draws no bar segments for a day with no steps", () => {
    const { container } = wrap(
      <CalendarCell
        d={day({ total_steps: "", run_steps: "", nonrun_steps: "" })}
        m={undefined}
        maxSteps={20000}
      />,
    );
    expect(widths(container)).toHaveLength(0);
  });

  it("OUTLINES a day only when it breached a measured ceiling", () => {
    const { container } = wrap(
      <CalendarCell
        d={day({})}
        m={meta({ se: 20000, ceiling: 18000 })}
        maxSteps={20000}
      />,
    );
    expect(container.querySelector(".cal-cell")!.className).toContain("over");
  });

  it("does not outline a day the plan never priced", () => {
    // A ceiling of null is a day whose prescription was incomplete; outlining
    // it states a breach of a standard nobody set.
    const { container } = wrap(
      <CalendarCell d={day({})} m={meta({ se: 20000, ceiling: null })} maxSteps={20000} />,
    );
    expect(container.querySelector(".cal-cell")!.className).not.toContain("over");
  });

  it("does not outline an ungraded day", () => {
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={20000} />);
    expect(container.querySelector(".cal-cell")!.className).not.toContain("over");
  });

  it("carries the SE breakdown in its tooltip when the day was graded", () => {
    const { container } = wrap(
      <CalendarCell
        d={day({})}
        m={meta({ se: 19000, run_se: 17500, nonrun_se: 1500, ceiling: 18000, role: "easy" })}
        maxSteps={20000}
      />,
    );
    fireEvent.mouseEnter(container.querySelector(".cal-cell")!, {
      clientX: 1,
      clientY: 1,
    });
    const tip = container.querySelector(".tooltip")!;
    expect(tip.textContent).toContain("easy");
    expect(tip.textContent).toContain("19,000");
    expect(tip.textContent).toContain("18,000");
  });

  it("omits the SE rows for an ungraded day rather than showing dashes", () => {
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={20000} />);
    fireEvent.mouseEnter(container.querySelector(".cal-cell")!, {
      clientX: 1,
      clientY: 1,
    });
    expect(container.querySelector(".tooltip")!.textContent).not.toContain("day SE");
  });

  it("is focusable, so the tooltip is not the only route to the value", () => {
    const { container } = wrap(<CalendarCell d={day({})} m={undefined} maxSteps={20000} />);
    expect(container.querySelector(".cal-cell")!.getAttribute("tabindex")).toBe("0");
  });
});
