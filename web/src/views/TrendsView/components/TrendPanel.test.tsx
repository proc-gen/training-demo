import { cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { Panel, PanelMark } from "../data/panels";
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

  it("gives a daily multi-series panel its slots too", () => {
    /* Two measured days three apart: the axis invents the two between, and the
       invented slots carry no values, so the one line BREAKS across the gap --
       a run of one point draws no path at all. */
    const p = panel({
      key: "fitness",
      title: "Fitness & fatigue",
      cadence: "day",
      seriesTitle: "TRIMP",
      format: (v) => v.toFixed(1),
      series: [{ key: "trimp", label: "TRIMP", color: "var(--cat-1)" }],
      points: [
        { date: "2026-08-10", label: "8/10", value: null, values: { trimp: 30.59 } },
        { date: "2026-08-13", label: "8/13", value: null, values: { trimp: 129.65 } },
      ],
    });
    const { container } = render(p, p.points, { from: "2026-08-10", to: "2026-08-13" });
    expect(container.querySelectorAll("path.series-line")).toHaveLength(0);
    expect(container.querySelector(".sm-range")!.textContent).toContain("2 of 2");
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
    values: { "800m": 140, "5000m": 1000, easy: { lo: 491, hi: 530 } },
  },
  {
    date: "2026-07-27",
    label: "7/27",
    value: null,
    vo2max: 56.81,
    values: { "800m": 138, "5000m": 990, easy: { lo: 489, hi: 528 } },
  },
];

const SERIES = [
  { key: "800m", label: "800m", color: "var(--cat-1)" },
  { key: "5000m", label: "5K", color: "var(--cat-2)" },
  { key: "easy", label: "Easy", color: "var(--cat-3)" },
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
const bandEdges = (c: HTMLElement) => c.querySelectorAll("path.series-edge");
const bandFills = (c: HTMLElement) => c.querySelectorAll("path[opacity='0.1']");
const dots = (c: HTMLElement) => c.querySelectorAll("circle.marker");

describe("TrendPanel, multi-series", () => {
  it("DEFAULTS TO EVERY SERIES ENABLED", () => {
    const { container } = render(multi());
    expect(boxes(container)).toHaveLength(3);
    expect(boxes(container).every((b) => b.checked)).toBe(true);
  });

  it("draws a line for each scalar series, and TWO EDGES for the band", () => {
    const { container } = render(multi());
    // Two scalar lines. The band contributes no `series-line` at all now --
    // it is a wash between two dashed edges, which is where it STOPS.
    expect(seriesLines(container)).toHaveLength(2);
    expect(bandEdges(container)).toHaveLength(2);
    expect(bandFills(container)).toHaveLength(1);
  });

  it("HIDES A SERIES when its box is unticked, and only that one", () => {
    const { container } = render(multi());
    const box = boxes(container).find((b) =>
      b.closest("label")!.textContent!.includes("Easy"),
    )!;
    fireEvent.click(box);
    expect(bandFills(container)).toHaveLength(0);
    expect(bandEdges(container)).toHaveLength(0);
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
    // `Times` draws all three series -- two scalar lines and one band, which is
    // two edges. The pace mode's points carry only 800m.
    expect(seriesLines(container)).toHaveLength(2);
    expect(bandEdges(container)).toHaveLength(2);
    fireEvent.click([...container.querySelectorAll(".unit-toggle button")][1]);
    expect(seriesLines(container)).toHaveLength(1);
    expect(bandEdges(container)).toHaveLength(0);
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

  it("passes the panel's reference rule through to the multi chart", () => {
    // The fitness panel's zero -- TSB crossing it is the reading.
    const { container } = render(multi({ reference: 500 }));
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
  });
});

/* ------------------------------------------------------------- pace groups */

const GROUP_POINTS = (values: Record<string, { lo: number; hi: number }>) =>
  MULTI_POINTS.map((p) => ({ ...p, values }));

const grouped = (): Panel =>
  panel({
    key: "target-paces",
    title: "Target paces",
    points: GROUP_POINTS({ rep_1min: { lo: 379, hi: 393 } }),
    series: [{ key: "rep_1min", label: "1 min reps", color: "var(--cat-1)" }],
    seriesTitle: "pace",
    defaultGroup: "subt",
    groups: [
      {
        key: "speed",
        label: "Tempo & repetition",
        series: [
          { key: "repetition", label: "Repetition", color: "var(--cat-1)" },
          { key: "tempo", label: "Tempo", color: "var(--cat-2)" },
        ],
        points: GROUP_POINTS({
          repetition: { lo: 294, hi: 332 },
          tempo: { lo: 368, hi: 374 },
        }),
      },
      {
        key: "subt",
        label: "Sub-threshold",
        series: [{ key: "rep_1min", label: "1 min reps", color: "var(--cat-1)" }],
        points: GROUP_POINTS({ rep_1min: { lo: 379, hi: 393 } }),
      },
      {
        key: "easy",
        label: "Easy / recovery",
        series: [
          { key: "easy", label: "Easy", color: "var(--cat-1)" },
          { key: "recovery", label: "Recovery", color: "var(--cat-2)" },
        ],
        points: GROUP_POINTS({
          easy: { lo: 491, hi: 530 },
          recovery: { lo: 530, hi: 576 },
        }),
      },
    ],
  });

const groupSelect = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLSelectElement>("select")].find(
    (x) => x.closest("label")?.textContent?.includes("Paces"),
  )!;

describe("TrendPanel, pace groups", () => {
  it("offers a group dropdown listing every group", () => {
    const { container } = render(grouped());
    expect([...groupSelect(container).querySelectorAll("option")].map((o) => o.value)).toEqual(
      ["speed", "subt", "easy"],
    );
  });

  it("OPENS ON THE GROUP THE PANEL POINTS AT, not on the first in the list", () => {
    /* `paceSeries` puts the default group on the panel own `series`/`points`,
       so the dropdown and the plot agree on the first paint. */
    const { container } = render(grouped());
    expect(groupSelect(container).value).toBe("subt");
    expect(boxes(container).map((b) => b.closest("label")!.textContent)).toEqual([
      "1 min reps",
    ]);
  });

  it("SWAPS THE SERIES SET when the group changes", () => {
    const { container } = render(grouped());
    fireEvent.change(groupSelect(container), { target: { value: "easy" } });
    expect(boxes(container).map((b) => b.closest("label")!.textContent)).toEqual([
      "Easy",
      "Recovery",
    ]);
    expect(bandFills(container)).toHaveLength(2);
  });

  it("RESETS THE TICKS with the group -- a shared key must not carry a hidden state", () => {
    const { container } = render(grouped());
    fireEvent.click(boxes(container)[0]);
    expect(boxes(container)[0].checked).toBe(false);
    fireEvent.change(groupSelect(container), { target: { value: "easy" } });
    expect(boxes(container).every((b) => b.checked)).toBe(true);
  });

  it("KEEPS THE WINDOW AND THE COUNT -- every group covers the same dates", () => {
    const { container } = render(grouped());
    const before = container.querySelector(".sm-range")!.textContent;
    fireEvent.change(groupSelect(container), { target: { value: "speed" } });
    expect(container.querySelector(".sm-range")!.textContent).toBe(before);
  });

  it("shows no group dropdown on a panel that states none", () => {
    const { container } = render(multi());
    expect(
      [...container.querySelectorAll("select")].some((x) =>
        x.closest("label")?.textContent?.includes("Paces"),
      ),
    ).toBe(false);
  });
});

/* ------------------------------------------------------ executed workout marks */

/** The two weekly slots the multi-series fixture spans: 7/20 and 7/27. */
const marked = (over: Partial<Panel> = {}) =>
  multi({
    marks: [{ date: "2026-07-22", key: "easy", value: 505, detail: "10 reps" }],
    ...over,
  });

const slotXs = (c: HTMLElement) =>
  [...c.querySelectorAll("line.gridline")]
    .filter((l) => l.getAttribute("x1") === l.getAttribute("x2"))
    .map((l) => Number(l.getAttribute("x1")))
    .sort((a, b) => a - b);

describe("TrendPanel, executed workouts", () => {
  it("draws a mark on ITS OWN DATE, between the two chart slots", () => {
    /* 2026-07-22 is two days past the 7/20 slot, so two sevenths of the way to
       7/27 -- which is where a Tuesday workout falls between two Sunday pace
       charts, and the whole reason `slotAt` returns a fraction. */
    const { container } = render(marked());
    expect(dots(container)).toHaveLength(1);
    const xs = slotXs(container);
    const cx = Number(dots(container)[0].getAttribute("cx"));
    expect(cx).toBeCloseTo(xs[0] + (2 / 7) * (xs[1] - xs[0]), 5);
  });

  it("paints it in its SERIES' colour, never its own", () => {
    const { container } = render(marked());
    expect(dots(container)[0].getAttribute("fill")).toBe("var(--cat-3)");
  });

  it("DROPS ITS MARKS when its series is unticked", () => {
    const { container } = render(marked());
    const box = boxes(container).find((b) =>
      b.closest("label")!.textContent!.includes("Easy"),
    )!;
    fireEvent.click(box);
    expect(dots(container)).toHaveLength(0);
  });

  it("drops a mark the window has no slots for", () => {
    /* A workout in a week the window clipped. `slotAt` refuses rather than
       extrapolating past the last slot, which would draw it outside the plot. */
    const { container } = render(
      marked({ marks: [{ date: "2026-08-05", key: "easy", value: 505, detail: "x" }] }),
    );
    expect(dots(container)).toHaveLength(0);
  });

  it("LEAVES `n of N points` ALONE -- a mark is not a point", () => {
    /* The caption counts what the SERIES measured. A workout is an observation
       dropped onto that grid, and counting it would inflate the caption with
       something the series never measured. */
    const plain = render(multi()).container.querySelector(".sm-range")!.textContent;
    cleanup();
    const withMarks = render(marked()).container.querySelector(".sm-range")!.textContent;
    expect(withMarks).toBe(plain);
  });

  it("states the ISO date and the caller's own wording on hover", () => {
    /* The ISO date because "7/22" is shared by every year, and a session is the
       one thing on this chart a reader may go and look up. */
    const { container } = render(marked());
    fireEvent.mouseEnter(dots(container)[0].closest("g")!, { clientX: 1, clientY: 1 });
    const tip = document.body.textContent ?? "";
    expect(tip).toContain("2026-07-22");
    expect(tip).toContain("10 reps");
  });

  it("takes the CHOSEN GROUP's marks, not the panel's, once a group is picked", () => {
    const grouped = multi({
      marks: [{ date: "2026-07-22", key: "easy", value: 505, detail: "panel" }],
      defaultGroup: "a",
      groups: [
        {
          key: "a",
          label: "A",
          series: SERIES,
          points: MULTI_POINTS,
          marks: [{ date: "2026-07-22", key: "easy", value: 505, detail: "group A" }],
        },
        {
          key: "b",
          label: "B",
          series: SERIES,
          points: MULTI_POINTS,
          marks: [],
        },
      ],
    });
    const { container } = render(grouped);
    fireEvent.mouseEnter(dots(container)[0].closest("g")!, { clientX: 1, clientY: 1 });
    expect(document.body.textContent ?? "").toContain("group A");

    // A DIFFERENT GROUP IS A DIFFERENT SERIES SET, and its marks go with it.
    const sel = container.querySelector<HTMLSelectElement>("select")!;
    fireEvent.change(sel, { target: { value: "b" } });
    expect(dots(container)).toHaveLength(0);
  });

  it("draws none at all on a panel that states no marks", () => {
    const { container } = render(multi());
    expect(dots(container)).toHaveLength(0);
  });
});

/* ------------------------------------------------------- the carried point */

/** The live-week shape: two measured charts, then the newest restated at the
 *  Sunday that will close the week in progress. */
const CARRIED: Panel["points"][number] = {
  date: "2026-08-03",
  label: "8/3",
  value: null,
  vo2max: null,
  carried: "2026-07-27",
  values: { "800m": 138, "5000m": 990, easy: { lo: 489, hi: 528 } },
};

/** A window ending mid-live-week, as `pointsIn` would resolve it: the carried
 *  8/3 point is kept because the week it closes began on 7/28. */
const LIVE: Range = { from: "2026-07-20", to: "2026-07-29" };

const carriedPanel = (over: Partial<Panel> = {}) =>
  multi({ points: [...MULTI_POINTS, CARRIED], ...over });

const hits = (c: HTMLElement) =>
  [...c.querySelectorAll("rect[fill='transparent']")];

describe("TrendPanel, a carried point", () => {
  it("LEAVES THE CAPTION AT THE MEASUREMENTS -- axis reach is not a point", () => {
    const { container } = render(carriedPanel(), [...MULTI_POINTS, CARRIED], LIVE);
    expect(container.querySelector(".sm-range")!.textContent).toContain("2 of 2 points");
  });

  it("states its provenance on hover, never a restated VO2max", () => {
    /* The carried-forward rule: a chart restated under a later date must SAY
       so, and its VO2max is the source chart's measurement. */
    const { container } = render(carriedPanel(), [...MULTI_POINTS, CARRIED], LIVE);
    fireEvent.mouseEnter(hits(container)[2], { clientX: 1, clientY: 1 });
    const tip = document.body.textContent ?? "";
    expect(tip).toContain("carried from 7/27");
    expect(tip).not.toContain("VO2max");
  });

  it("keeps the VO2max row on the measured points beside it", () => {
    const { container } = render(carriedPanel(), [...MULTI_POINTS, CARRIED], LIVE);
    fireEvent.mouseEnter(hits(container)[1], { clientX: 1, clientY: 1 });
    expect(document.body.textContent ?? "").toContain("VO2max");
  });

  it("PLACES A LIVE-WEEK MARK on the carried segment -- the 8/25 case", () => {
    /* The whole point of the extension: a workout run after the newest
       confirmed chart has a pair of slots to land between. 7/29 is two days
       past the 7/27 slot, two sevenths of the way to the carried 8/3. */
    const { container } = render(
      carriedPanel({
        marks: [{ date: "2026-07-29", key: "easy", value: 505, detail: "12 reps" }],
      }),
      [...MULTI_POINTS, CARRIED],
      LIVE,
    );
    expect(dots(container)).toHaveLength(1);
    const xs = slotXs(container);
    const cx = Number(dots(container)[0].getAttribute("cx"));
    expect(cx).toBeCloseTo(xs[1] + (2 / 7) * (xs[2] - xs[1]), 5);
  });
});

/* ---------------------------------------------------- the workouts toggle */

const toggleBox = (c: HTMLElement) =>
  c.querySelector<HTMLInputElement>(".marks-toggle input");

describe("TrendPanel, the workouts toggle", () => {
  it("offers Workouts, ON by default, on a panel that carries marks", () => {
    const { container } = render(marked());
    expect(toggleBox(container)).toBeTruthy();
    expect(toggleBox(container)!.checked).toBe(true);
  });

  it("offers none on a panel without marks", () => {
    expect(toggleBox(render(multi()).container)).toBeNull();
    cleanup();
    expect(toggleBox(render().container)).toBeNull();
  });

  it("HIDES EVERY DOT unticked, and restores them", () => {
    const { container } = render(marked());
    expect(dots(container)).toHaveLength(1);
    fireEvent.click(toggleBox(container)!);
    expect(dots(container)).toHaveLength(0);
    fireEvent.click(toggleBox(container)!);
    expect(dots(container)).toHaveLength(1);
  });

  it("leaves the caption alone -- marks were never in the count", () => {
    const { container } = render(marked());
    const before = container.querySelector(".sm-range")!.textContent;
    fireEvent.click(toggleBox(container)!);
    expect(container.querySelector(".sm-range")!.textContent).toBe(before);
  });

  it("UN-WIDENS THE SCALE -- a hidden measurement must not shape the axis", () => {
    /* `MultiLineChart` widens its y domain to keep a mark inside the plot; a
       hidden mark passed along anyway would leave the bands squashed under an
       axis sized for a dot nobody can see. */
    const { container } = render(
      marked({ marks: [{ date: "2026-07-22", key: "easy", value: 9999, detail: "x" }] }),
    );
    const axisMax = () =>
      Math.max(
        ...[...container.querySelectorAll("text")]
          .map((t) => parseFloat(t.textContent ?? ""))
          .filter((v) => Number.isFinite(v)),
      );
    expect(axisMax()).toBeGreaterThanOrEqual(9999);
    fireEvent.click(toggleBox(container)!);
    expect(axisMax()).toBeLessThan(9999);
  });

  it("SURVIVES A GROUP CHANGE, unlike the series ticks", () => {
    /* Marks are orthogonal to which series set is showing, so the choice holds
       while `off` resets -- panel state, reset only by the graph switch. */
    const grouped = multi({
      defaultGroup: "a",
      groups: [
        {
          key: "a",
          label: "A",
          series: SERIES,
          points: MULTI_POINTS,
          marks: [{ date: "2026-07-22", key: "easy", value: 505, detail: "group A" }],
        },
        { key: "b", label: "B", series: SERIES, points: MULTI_POINTS, marks: [] },
      ],
    });
    const { container } = render(grouped);
    fireEvent.click(toggleBox(container)!);
    expect(dots(container)).toHaveLength(0);

    const sel = container.querySelector<HTMLSelectElement>("select")!;
    fireEvent.change(sel, { target: { value: "b" } });
    fireEvent.change(sel, { target: { value: "a" } });
    expect(toggleBox(container)!.checked).toBe(false);
    expect(dots(container)).toHaveLength(0);
    // The toggle itself did not vanish with the mark-less group either --
    // presence is panel-level, so the control cannot pop in and out.
    fireEvent.change(sel, { target: { value: "b" } });
    expect(toggleBox(container)).toBeTruthy();
  });

  it("wears the panel's own word, defaulting to Workouts", () => {
    const { q } = render(marked());
    expect(q.getByRole("checkbox", { name: "Workouts" })).toBeTruthy();
    cleanup();
    const races = render(marked({ marksLabel: "Races" }));
    expect(races.q.getByRole("checkbox", { name: "Races" })).toBeTruthy();
  });
});

/* --------------------------------------------------------- the race marks */

/** The race panel's shape: two modes, EACH with its own marks -- one race is
 *  two numbers, and a mode's marks are that quantity's own values. The marks
 *  are STANDALONE: no series key, their own colour, their own value-row name. */
const raceMark = (over: Partial<PanelMark> = {}): PanelMark => ({
  date: "2026-07-22",
  color: "var(--text-primary)",
  name: "time",
  kind: "race",
  value: 950,
  detail: "3.09 mi",
  ...over,
});

const modeMarked = () =>
  multi({
    marks: [raceMark()],
    marksLabel: "Races",
    modes: [
      {
        key: "time",
        label: "Times",
        points: MULTI_POINTS,
        marks: [raceMark()],
        format: (v) => `${v}s`,
      },
      {
        key: "pace",
        label: "min/mi",
        points: MULTI_POINTS,
        marks: [raceMark({ name: "pace", value: 280 })],
        format: (v) => `${v}/mi`,
      },
    ],
  });

describe("TrendPanel, race marks on a moded panel", () => {
  it("draws the ACTIVE MODE's marks -- a mode is a different quantity", () => {
    /* Falling through to `panel.marks` on a moded panel would plot seconds on
       a min/mi scale silently; the mode leads, like `points` and `format`. */
    const { container } = render(modeMarked());
    expect(dots(container)).toHaveLength(1);
    fireEvent.mouseEnter(dots(container)[0].closest("g")!, { clientX: 1, clientY: 1 });
    expect(document.body.textContent ?? "").toContain("950s");
  });

  it("SWAPS THE MARK VALUES with the unit toggle", () => {
    const { container } = render(modeMarked());
    const before = Number(dots(container)[0].getAttribute("cy"));
    fireEvent.click([...container.querySelectorAll(".unit-toggle button")][1]);
    expect(dots(container)).toHaveLength(1);
    expect(Number(dots(container)[0].getAttribute("cy"))).not.toBe(before);
    fireEvent.mouseEnter(dots(container)[0].closest("g")!, { clientX: 1, clientY: 1 });
    const tip = document.body.textContent ?? "";
    expect(tip).toContain("280/mi");
    expect(tip).toContain("pace");
  });

  it("words the tooltip with the mark's OWN kind -- race, not workout", () => {
    const { container } = render(modeMarked());
    fireEvent.mouseEnter(dots(container)[0].closest("g")!, { clientX: 1, clientY: 1 });
    const tip = document.body.textContent ?? "";
    expect(tip).toContain("race");
    expect(tip).toContain("3.09 mi");
    expect(tip).not.toContain("workout");
  });

  it("still says workout on a mark that predates the field", () => {
    const { container } = render(marked());
    fireEvent.mouseEnter(dots(container)[0].closest("g")!, { clientX: 1, clientY: 1 });
    expect(document.body.textContent ?? "").toContain("workout");
  });

  it("keeps a standalone dot when ITS distance's line is unticked", () => {
    /* Races don't go on lines -- the athlete's ruling -- so no series tick can
       touch one; only the Races toggle hides them. */
    const { container } = render(modeMarked());
    fireEvent.click(boxes(container)[0]);
    expect(dots(container)).toHaveLength(1);
    expect(dots(container)[0].getAttribute("fill")).toBe("var(--text-primary)");
  });

  it("hides the dots in EVERY mode through the one toggle", () => {
    const { container } = render(modeMarked());
    fireEvent.click(toggleBox(container)!);
    expect(dots(container)).toHaveLength(0);
    fireEvent.click([...container.querySelectorAll(".unit-toggle button")][1]);
    expect(dots(container)).toHaveLength(0);
  });

  it("offers the toggle off the panel-level mirror of the first mode's marks", () => {
    /* The presence check reads `panel.marks`; `paceSeries` mirrors
       `modes[0].marks` there for exactly this. */
    expect(toggleBox(render(modeMarked()).container)).toBeTruthy();
  });
});
