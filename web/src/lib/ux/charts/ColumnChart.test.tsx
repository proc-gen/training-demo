import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { ColumnChart } from "./ColumnChart";
import type { Column } from "./data/scales";

afterEach(cleanup);

const col = (
  label: string,
  values: (number | null)[],
  ceiling?: number | null,
): Column => ({
  label,
  ceiling,
  parts: values.map((v, i) => ({
    value: v,
    color: i ? "var(--series-2)" : "var(--series-1)",
  })),
});

const WEEK = [
  col("Mon", [7000, 3000], 18000),
  col("Tue", [12000, 4000], 15000),
  col("Wed", [0, 0], 8000),
];

describe("ColumnChart", () => {
  it("draws one hover group per column", () => {
    const { container } = wrap(<ColumnChart columns={WEEK} />);
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(3);
  });

  it("stacks the parts of a column into separate rects", () => {
    const { container } = wrap(<ColumnChart columns={[col("Mon", [7000, 3000])]} />);
    const g = container.querySelector("[role='listitem']")!;
    expect(g.querySelectorAll("rect")).toHaveLength(2);
  });

  it("skips a zero part rather than drawing a hairline for it", () => {
    const { container } = wrap(<ColumnChart columns={[col("Mon", [7000, 0])]} />);
    const g = container.querySelector("[role='listitem']")!;
    expect(g.querySelectorAll("rect")).toHaveLength(1);
  });

  it("draws a ceiling rule where the column has a bar", () => {
    const { container } = wrap(<ColumnChart columns={[col("Mon", [7000], 18000)]} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
  });

  it("draws NO ceiling on a column with no bar", () => {
    /* On a day the export never covered, a rule floating over an empty slot
     * states a target nothing was measured against, and reads as debris. */
    const { container } = wrap(<ColumnChart columns={[col("Wed", [0, 0], 8000)]} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(0);
  });

  it("draws one ceiling for the two priced days and none for the empty one", () => {
    const { container } = wrap(<ColumnChart columns={WEEK} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(2);
  });

  it("keeps every mark inside the plot, ceilings included", () => {
    /* THE REGRESSION niceTicks exists for: the caller takes the top tick as the
     * scale ceiling, so a 34,000 ceiling against a 30,000 top tick drew at a
     * negative y and put a red rule across the legend. */
    const cols = [col("Mon", [15258], 34000), col("Tue", [49360], 34000)];
    const { container } = wrap(<ColumnChart columns={cols} height={240} />);
    const svg = container.querySelector("svg")!;
    for (const el of svg.querySelectorAll("rect, line")) {
      for (const attr of ["y", "y1", "y2"]) {
        const v = el.getAttribute(attr);
        if (v === null) continue;
        expect(parseFloat(v)).toBeGreaterThanOrEqual(-0.001);
        expect(parseFloat(v)).toBeLessThanOrEqual(240.001);
      }
    }
  });

  it("labels every column", () => {
    const { container } = wrap(<ColumnChart columns={WEEK} />);
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    for (const c of WEEK) expect(text).toContain(c.label);
  });

  describe("a window's worth of columns", () => {
    /* The Trends view plots a column per DAY over a range the reader chooses.
     * One label per column is right for a week and an unreadable smear for a
     * month. */
    const month = Array.from({ length: 31 }, (_, i) => col(`8/${i + 1}`, [50, 5]));

    it("THINS the labels rather than overlapping them", () => {
      const { container } = wrap(<ColumnChart columns={month} />);
      const labels = [...container.querySelectorAll("text")]
        .map((t) => t.textContent!)
        .filter((t) => t.startsWith("8/"));
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.length).toBeLessThan(month.length);
    });

    it("always labels the NEWEST column", () => {
      // It is the one a reader anchors on.
      const { container } = wrap(<ColumnChart columns={month} />);
      const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
      expect(text).toContain("8/31");
    });

    it("still draws every column", () => {
      // Thinning is about labels, never about marks.
      const { container } = wrap(<ColumnChart columns={month} />);
      expect(container.querySelectorAll("[role='listitem']")).toHaveLength(31);
    });

    it("leaves a week-sized chart labelled in full", () => {
      const { container } = wrap(<ColumnChart columns={WEEK} />);
      const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
      for (const c of WEEK) expect(text).toContain(c.label);
    });
  });

  it("formats axis ticks through the supplied formatter", () => {
    const { container } = wrap(
      <ColumnChart columns={WEEK} tick={(t) => `${t} SE`} />,
    );
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text.some((t) => t?.endsWith(" SE"))).toBe(true);
  });

  it("carries an accessible name", () => {
    const { container } = wrap(<ColumnChart columns={WEEK} label="SE per day" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("SE per day");
  });

  it("renders without throwing on no columns at all", () => {
    const { container } = wrap(<ColumnChart columns={[]} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(0);
  });

  it("binds a tooltip only where one was supplied", () => {
    const { container } = wrap(
      <ColumnChart
        columns={[
          { ...col("Mon", [100]), tip: () => <b>mon</b> },
          col("Tue", [100]),
        ]}
      />,
    );
    const groups = [...container.querySelectorAll("[role='listitem']")];
    expect(groups[0].getAttribute("tabindex")).toBe("0");
    expect(groups[1].getAttribute("tabindex")).toBeNull();
  });
});
