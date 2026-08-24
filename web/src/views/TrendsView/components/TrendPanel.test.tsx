import { cleanup, fireEvent, within } from "@testing-library/react";
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
  cadence: "week",
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
      cadence: "day",
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

describe("the x axis", () => {
  /* One slot per date, so position means time. `shown` carries measurements
   * only, and a week the athlete did not run at all is simply absent from it. */
  const GAPPED: Panel["points"] = [
    { date: "2026-03-09", label: "3/9", value: 41 },
    { date: "2026-04-13", label: "4/13", value: 12 },
  ];

  it("reserves a slot for every missing week, and breaks the line there", () => {
    const p = panel({ points: GAPPED });
    const { container } = render(p, GAPPED, {
      from: "2026-03-09",
      to: "2026-04-13",
    });
    // Two marks, five weeks apart, and no segment drawn across the hole.
    expect(container.querySelectorAll("circle.marker")).toHaveLength(2);
    expect(container.querySelectorAll("path.series-line")).toHaveLength(0);
  });

  it("counts MEASUREMENTS in the caption, never the slots it invented", () => {
    const p = panel({ points: GAPPED });
    const { container } = render(p, GAPPED, {
      from: "2026-03-09",
      to: "2026-04-13",
    });
    expect(container.querySelector(".sm-range")!.textContent).toContain(
      "2 of 2 points",
    );
  });

  it("puts the year on the labels once the window crosses one", () => {
    const points: Panel["points"] = [
      { date: "2025-12-29", label: "12/29", value: 40 },
      { date: "2026-01-05", label: "1/5", value: 44 },
    ];
    const p = panel({ points });
    const { container } = render(p, points, { from: "2025-12-29", to: "2026-01-05" });
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text).toContain("12/29/25");
    expect(text).toContain("1/5/26");
  });

  it("leaves the year off a window inside one year", () => {
    const { container } = render();
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text).toContain("7/20");
    expect(text.some((t) => t?.includes("/26"))).toBe(false);
  });

  it("gives a stacked panel its slots too", () => {
    const p = panel({
      key: "trimp",
      title: "Daily TRIMP",
      kind: "columns",
      cadence: "day",
      seriesTitle: "TRIMP",
      format: (v) => v.toFixed(1),
      points: [
        {
          date: "2026-08-10",
          label: "8/10",
          value: 30.59,
          parts: [{ value: 30.59, color: "var(--series-1)", label: "run" }],
        },
        {
          date: "2026-08-13",
          label: "8/13",
          value: 129.65,
          parts: [{ value: 129.65, color: "var(--series-1)", label: "run" }],
        },
      ],
    });
    const { container } = render(p, p.points, { from: "2026-08-10", to: "2026-08-13" });
    // Four days, two of them with a bar to draw.
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(4);
    expect(container.querySelectorAll("rect")).toHaveLength(2);
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

/* ------------------------------------------------------- multi-series panels */

const MULTI_POINTS: Panel["points"] = [
  {
    date: "2026-07-20",
    label: "7/20",
    value: null,
    vo2max: 55.9,
    values: { "800m": 140, "5000m": 1000, easy_recovery: { lo: 491, hi: 576, mid: 530 } },
  },
  {
    date: "2026-07-27",
    label: "7/27",
    value: null,
    vo2max: 56.81,
    values: { "800m": 138, "5000m": 990, easy_recovery: { lo: 489, hi: 574, mid: 528 } },
  },
];

const SERIES = [
  { key: "800m", label: "800m", color: "var(--cat-1)" },
  { key: "5000m", label: "5K", color: "var(--cat-2)" },
  { key: "easy_recovery", label: "Easy / Recovery", color: "var(--cat-3)" },
];

const multi = (over: Partial<Panel> = {}): Panel =>
  panel({
    key: "race-times",
    title: "Projected race times",
    points: MULTI_POINTS,
    series: SERIES,
    seriesTitle: "time",
    ...over,
  });

const withModes = () =>
  multi({
    modes: [
      { key: "time", label: "Times", points: MULTI_POINTS, format: (v) => `${v}s` },
      {
        key: "pace",
        label: "min/mi",
        points: MULTI_POINTS.map((p) => ({ ...p, values: { "800m": 280 } })),
        format: (v) => `${v}/mi`,
      },
    ],
  });

const boxes = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLInputElement>("input[type='checkbox']")];
const seriesLines = (c: HTMLElement) => c.querySelectorAll("path.series-line");
const bandFills = (c: HTMLElement) => c.querySelectorAll("path[opacity='0.22']");

describe("TrendPanel, multi-series", () => {
  it("DEFAULTS TO EVERY SERIES ENABLED", () => {
    const { container } = render(multi());
    expect(boxes(container)).toHaveLength(3);
    expect(boxes(container).every((b) => b.checked)).toBe(true);
  });

  it("draws a line for each scalar series and a fill for the band", () => {
    const { container } = render(multi());
    // Two scalar lines, plus the seam ruled through the merged region.
    expect(seriesLines(container)).toHaveLength(3);
    expect(bandFills(container)).toHaveLength(1);
  });

  it("HIDES A SERIES when its box is unticked, and only that one", () => {
    const { container } = render(multi());
    const box = boxes(container).find((b) =>
      b.closest("label")!.textContent!.includes("Easy / Recovery"),
    )!;
    fireEvent.click(box);
    expect(bandFills(container)).toHaveLength(0);
    // The two scalar lines survive untouched.
    expect(seriesLines(container)).toHaveLength(2);
  });

  it("says so plainly when every box is unticked", () => {
    const { container, q } = render(multi());
    for (const b of boxes(container)) fireEvent.click(b);
    /* Its own sentence, not "no points in this range" -- that one would send the
       reader off to widen a window that was never the problem. */
    expect(q.getByText("No series selected.")).toBeTruthy();
  });

  it("keeps the counts stable when a series is hidden", () => {
    const { container } = render(multi());
    const before = container.querySelector(".sm-range")!.textContent;
    fireEvent.click(boxes(container)[0]);
    expect(container.querySelector(".sm-range")!.textContent).toBe(before);
  });

  it("shows NO unit toggle on a panel that states no modes", () => {
    const { container } = render(multi());
    expect(container.querySelector(".unit-toggle")).toBeNull();
  });

  it("offers one when the panel does, pressed on the first mode", () => {
    const { container } = render(withModes());
    const pills = [...container.querySelectorAll(".unit-toggle button")];
    expect(pills.map((b) => b.textContent)).toEqual(["Times", "min/mi"]);
    expect(pills[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("SWITCHES THE POINT SET, not just the formatter", () => {
    const { container } = render(withModes());
    // `Times` draws all three series; the pace mode's points carry only 800m.
    expect(seriesLines(container)).toHaveLength(3);
    fireEvent.click([...container.querySelectorAll(".unit-toggle button")][1]);
    expect(seriesLines(container)).toHaveLength(1);
    expect(bandFills(container)).toHaveLength(0);
  });

  it("formats the axis with the ACTIVE mode's formatter", () => {
    const { container } = render(withModes());
    const texts = () =>
      [...container.querySelectorAll("text")].map((t) => t.textContent ?? "");
    expect(texts().some((t) => t.endsWith("s"))).toBe(true);
    fireEvent.click([...container.querySelectorAll(".unit-toggle button")][1]);
    expect(texts().some((t) => t.endsWith("/mi"))).toBe(true);
  });

  it("names every series in the picker, so colour is never the only channel", () => {
    const { container } = render(multi());
    /* SCOPED TO THE PICKER. The chart also end-labels each line with the same
       words, which is the point -- two channels -- so an unscoped query finds
       both and fails on the duplication it exists to check for. */
    const picker = within(container.querySelector<HTMLElement>(".series-picker")!);
    for (const s of SERIES) expect(picker.getByText(s.label)).toBeTruthy();
  });

  it("still states its window and count like every other panel", () => {
    const { container } = render(multi());
    expect(container.querySelector(".sm-range")!.textContent).toContain(
      "2026-07-20 → 2026-07-27",
    );
    expect(container.querySelector(".sm-range")!.textContent).toContain("2 of 2 points");
  });

  it("COUNTS A MULTI-SERIES POINT even though its `value` is null", () => {
    /* Every point here carries `value: null` -- the count comes from `drawn`,
       and reading `value` would report "0 of 0 points" on a full chart. */
    expect(MULTI_POINTS.every((p) => p.value === null)).toBe(true);
    const { container } = render(multi());
    expect(container.querySelector(".sm-range")!.textContent).toContain("2 of 2");
  });

  it("renders no picker at all on an ordinary single-series panel", () => {
    const { container } = render();
    expect(container.querySelector(".series-picker")).toBeNull();
    expect(container.querySelector(".unit-toggle")).toBeNull();
  });
});
