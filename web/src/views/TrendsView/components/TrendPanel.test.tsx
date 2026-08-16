import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { Panel } from "../data/panels";
import type { Range } from "../data/range";
import { TrendPanel } from "./TrendPanel";

afterEach(cleanup);

const POINTS: Panel["points"] = [
  { date: "2026-07-20", label: "7/20", value: 40 },
  { date: "2026-07-27", label: "7/27", value: 44 },
];

const panel = (over: Partial<Panel> = {}): Panel => ({
  key: "volume",
  title: "Weekly volume",
  points: POINTS,
  seriesTitle: "miles",
  format: (v) => `${v} mi`,
  ...over,
});

const WHOLE: Range = { from: "2026-07-20", to: "2026-07-27" };

const render = (p: Panel = panel(), shown = p.points, range: Range | null = WHOLE) =>
  wrap(<TrendPanel panel={p} shown={shown} range={range} />);

describe("TrendPanel", () => {
  it("titles the panel", () => {
    const { container } = render();
    expect(container.querySelector(".sm-title")!.textContent).toBe("Weekly volume");
  });

  it("STATES NO DESCRIPTION under the title", () => {
    /* `.sm-sub` carried one, plus an omission sentence where there was one. The
     * athlete asked for the line to go on 2026-08-15. */
    const { container } = render();
    expect(container.querySelector(".sm-sub")).toBeNull();
  });

  it("draws the series it was given, not the whole panel", () => {
    const { container } = render(panel(), POINTS.slice(0, 1));
    expect(container.querySelectorAll("circle.marker")).toHaveLength(1);
  });

  it("has NO legend on a line panel -- one series, and the title names it", () => {
    const { container } = render();
    expect(container.querySelector(".legend")).toBeNull();
  });

  it("uses the panel's own formatter", () => {
    const { container } = render();
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text.some((t) => t?.endsWith(" mi"))).toBe(true);
  });

  it("passes the colour through", () => {
    const { container } = render(panel({ color: "var(--series-3)" }));
    expect(container.querySelector("circle.marker")!.getAttribute("fill")).toBe(
      "var(--series-3)",
    );
  });

  it("draws a reference line when the panel has one in range", () => {
    const { container } = render(panel({ reference: 42 }));
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
  });

  it("names the chart after the panel, for a screen reader", () => {
    const { container } = render();
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "Weekly volume",
    );
  });
});

describe("a stacked panel", () => {
  const part = (value: number | null, which: 0 | 1) => ({
    value,
    color: which ? "var(--series-2)" : "var(--series-1)",
    label: which ? "background" : "run",
  });

  const trimp = (bg: number | null = 4.19): Panel =>
    panel({
      key: "trimp",
      title: "Daily TRIMP",
      kind: "columns",
      seriesTitle: "TRIMP",
      format: (v) => v.toFixed(1),
      points: [
        {
          date: "2026-08-10",
          label: "8/10",
          value: 30.59,
          parts: [part(30.59, 0), part(bg, 1)],
        },
        {
          date: "2026-08-11",
          label: "8/11",
          value: 129.65,
          parts: [part(129.65, 0), part(11.28, 1)],
        },
      ],
    });

  it("draws BARS rather than a line", () => {
    const { container } = render(trimp());
    expect(container.querySelectorAll("circle.marker")).toHaveLength(0);
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(2);
  });

  it("stacks each point's parts", () => {
    const { container } = render(trimp());
    const first = container.querySelectorAll("[role='listitem']")[0];
    expect(first.querySelectorAll("rect")).toHaveLength(2);
  });

  it("carries a legend, because there IS more than one thing in the plot", () => {
    const { container } = render(trimp());
    const labels = [...container.querySelectorAll(".legend-item")].map(
      (e) => e.textContent,
    );
    expect(labels).toEqual(["run", "background"]);
  });

  it("draws only the windowed columns", () => {
    const p = trimp();
    const { container } = render(p, p.points.slice(0, 1));
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(1);
  });

  it("still draws a day whose background was never measured", () => {
    // The bar is the running impulse alone; the tooltip is where the absence is
    // stated. Dropping the day would lose a measurement.
    const { container } = render(trimp(null));
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(2);
  });
});

describe("the window it says it is showing", () => {
  it("names both ends", () => {
    const { container } = render();
    const line = container.querySelector(".sm-range")!.textContent!;
    expect(line).toContain("2026-07-20");
    expect(line).toContain("2026-07-27");
  });

  it("states `n of N`, never a bare count", () => {
    /* A filtered view stating only what it holds reads as a complete account of
     * the series. */
    const { container } = render(panel(), POINTS.slice(0, 1));
    expect(container.querySelector(".sm-range")!.textContent).toContain(
      "1 of 2 points",
    );
  });

  it("counts only the points a chart would DRAW", () => {
    // A null is a day nobody measured; LineChart skips it.
    const p = panel({
      points: [...POINTS, { date: "2026-08-03", label: "8/3", value: null }],
    });
    const { container } = render(p, p.points);
    expect(container.querySelector(".sm-range")!.textContent).toContain(
      "2 of 2 points",
    );
  });

  it("still states the count with no window resolved", () => {
    const { container } = render(panel(), POINTS, null);
    expect(container.querySelector(".sm-range")!.textContent).toContain("2 of 2");
  });
});

describe("a window with nothing in it", () => {
  const empty: Range = { from: "2025-01-01", to: "2025-12-31" };

  it("says so rather than drawing a blank plot", () => {
    /* An empty chart states that a measurement exists and is flat -- the same
     * reason `trendPanels` omits a panel with no series rather than drawing
     * one. */
    const { container } = render(panel(), [], empty);
    expect(container.querySelector("svg.chart")).toBeNull();
    expect(container.querySelector(".empty-state")!.textContent).toContain(
      "No points in this range",
    );
  });

  it("names where the series DOES run, so the window can be fixed", () => {
    const { container } = render(panel(), [], empty);
    const said = container.querySelector(".empty-state")!.textContent!;
    expect(said).toContain("2026-07-20");
    expect(said).toContain("2026-07-27");
  });

  it("reports zero of the total", () => {
    const { container } = render(panel(), [], empty);
    expect(container.querySelector(".sm-range")!.textContent).toContain("0 of 2");
  });

  it("does not claim a span for a panel that plots nothing at all", () => {
    const { container } = render(panel({ points: [] }), [], empty);
    expect(container.querySelector(".empty-state")!.textContent).toBe(
      "No points in this range.",
    );
  });
});
