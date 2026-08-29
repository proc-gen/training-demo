import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { TrendsView } from "./TrendsView";
import { trendPanels } from "./data/panels";
import { defaultRange } from "./data/range";

afterEach(cleanup);

const D = PUBLISHED;

const empty = { weeks: {}, days: [], history: {} } as unknown as Payload;

/** A week that was run, carrying its measured mileage. */
const ran = (miles: number) => ({
  adherence: { results: [{ id: 1 }], facts: { miles }, scores: { week: { pct: 90 } } },
});

/** A payload whose series are known end to end, so a window can be asserted
 *  against dates rather than against the arithmetic that produced them. */
const SYNTH = {
  weeks: {
    "2026-01-05": ran(30),
    "2026-07-20": ran(40),
    "2026-08-15": ran(44),
  },
  days: [
    { date: "2026-07-01", hrv: "70" },
    { date: "2026-08-01", hrv: "72" },
  ],
  history: {},
} as unknown as Payload;

const select = (c: HTMLElement) => c.querySelector("select") as HTMLSelectElement;
const range = (c: HTMLElement) => c.querySelector(".sm-range")!.textContent!;
const title = (c: HTMLElement) => c.querySelector(".sm-title")!.textContent!;
const pill = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll("button.tab")].find((b) => b.textContent === label)!;
const dates = (c: HTMLElement) =>
  [...c.querySelectorAll('input[type="date"]')] as HTMLInputElement[];

describe("TrendsView", () => {
  has(D)("renders a chart without throwing", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(container.querySelectorAll("svg.chart").length).toBe(1);
    const cards = [...container.querySelectorAll("section.card > h2")].map(
      (e) => e.textContent,
    );
    expect(cards).toContain("Trends");
  });

  has(D)("shows ONE graph at a time -- never two scales on one plot", () => {
    /* It was eleven small multiples until 2026-08-15: no series was big enough
     * to read, and every one covered its whole history. */
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(container.querySelectorAll(".sm-title")).toHaveLength(1);
    expect(container.querySelectorAll("svg.chart").length).toBeLessThanOrEqual(1);
  });

  has(D)("offers every panel that has data, whatever the window", () => {
    // A list that reshuffles as the range moves is one a reader cannot learn.
    const { container } = wrap(<TrendsView payload={D!} />);
    const offered = [...select(container).querySelectorAll("option")].map(
      (o) => o.value,
    );
    expect(offered).toEqual(trendPanels(D!).map((p) => p.key));
  });

  has(D)("opens on the first panel in display order", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(select(container).value).toBe(trendPanels(D!)[0].key);
    expect(title(container)).toBe(trendPanels(D!)[0].title);
  });

  has(D)("opens on the DEFAULT window", () => {
    /* The wiring, not the arithmetic -- `range.test.ts` pins what a month
     * before the newest data point is. */
    const { container } = wrap(<TrendsView payload={D!} />);
    const want = defaultRange(trendPanels(D!))!;
    expect(range(container)).toContain(`${want.from} → ${want.to}`);
    expect(dates(container).map((i) => i.value)).toEqual([want.from, want.to]);
  });

  has(D)("ENDS ITS DEFAULT WINDOW AT THE NEWEST MEASUREMENT", () => {
    /* The defect that started this round: the plan reaches two Mondays ahead,
     * those week records carry zeros and nulls rather than nothing, and every
     * preset resolved against 2026-08-24 -- a week nobody had run. "Unrun"
     * here is the view's own predicate PAIR from `panels.ts`: no adherence
     * results AND no load days -- a live week whose Monday already carries a
     * measured day (steps, a TRIMP row) legitimately ends the window on that
     * date even while its runs await reconciliation. */
    const { container } = wrap(<TrendsView payload={D!} />);
    const unrun = Object.keys(D!.weeks).filter(
      (k) =>
        !(D!.weeks[k].adherence?.results ?? []).length &&
        !(D!.weeks[k].load?.days ?? []).length,
    );
    expect(unrun.length).toBeGreaterThan(0); // not a vacuous check
    for (const k of unrun) expect(range(container)).not.toContain(`→ ${k}`);
  });

  has(D)("STATES NO OMISSION AND NO DESCRIPTION", () => {
    /* Both were the dimmed line under the title; the athlete had it removed on
     * 2026-08-15. The omissions still HAPPEN -- a partly-covered week is still
     * dropped from the load series -- and are reported in conversation now. */
    const { container } = wrap(<TrendsView payload={D!} />);
    fireEvent.change(select(container), { target: { value: "load" } });
    expect(container.querySelector(".sm-sub")).toBeNull();
    expect(container.textContent).not.toContain("omitted");
  });

  has(D)("no chart mark escapes its plot area", () => {
    /* niceTicks once stopped BELOW max, the caller took the top tick as the
     * ceiling, and a 34,000 day ceiling against a 30,000 top tick drew a red
     * rule across the legend. Bars may never overflow their axis. */
    const { container } = wrap(<TrendsView payload={D!} />);
    for (const svg of container.querySelectorAll("svg.chart")) {
      const vb = svg.getAttribute("viewBox")!.split(" ").map(Number);
      const [, , , h] = vb;
      for (const el of svg.querySelectorAll("circle, rect")) {
        const y = parseFloat(el.getAttribute("cy") ?? el.getAttribute("y") ?? "0");
        expect(y).toBeGreaterThanOrEqual(-0.001);
        expect(y).toBeLessThanOrEqual(h + 0.001);
      }
    }
  });

  has(D)("CLOSES WITH NOTHING", () => {
    /* The note stated the colour convention and the one-scale rule, which are
     * rules for whoever adds a panel rather than facts a reader needs. Athlete's
     * instruction, 2026-08-15; both rules are enforced in `trendPanels`' header,
     * beside the list they govern. */
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(container.querySelector(".note")).toBeNull();
  });

  has(D)("offers the combined fitness graph, with the old four merged into it", () => {
    /* Daily TRIMP, CTL, TSB and ATL were four picker entries until 2026-08-27;
     * the series checkboxes are the picker entries now. Lines, not bars -- the
     * athlete's choice -- so no stacked-bar listitems and no separate legend:
     * the checkbox row names the series. */
    const { container } = wrap(<TrendsView payload={D!} />);
    for (const old of ["trimp", "ctl", "tsb", "atl"]) {
      expect(
        container.querySelector(`option[value='${old}']`),
        old,
      ).toBeNull();
    }
    fireEvent.change(select(container), { target: { value: "fitness" } });
    expect(title(container)).toBe("Fitness & fatigue");
    const boxes = [...container.querySelectorAll(".series-item")].map(
      (e) => e.textContent,
    );
    expect(boxes).toEqual(["TRIMP", "background", "Fitness", "Fatigue", "Form"]);
    expect(container.querySelectorAll("path.series-line").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(0);
    expect(container.querySelectorAll(".legend-item")).toHaveLength(0);
  });

  has(D)("plots resting heart rate daily", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    fireEvent.change(select(container), { target: { value: "rhr" } });
    expect(title(container)).toBe("Resting heart rate");
    // A weekly mean over these dates would be a seventh of the points.
    const daysWithRhr = (D!.days ?? []).filter((d) => d.resting_hr).length;
    expect(range(container)).toContain(`of ${daysWithRhr} points`);
  });

  it("says so when there are no series at all", () => {
    const { q } = wrap(<TrendsView payload={empty} />);
    expect(q.getByText("No series yet.")).toBeTruthy();
  });
});

describe("choosing a graph", () => {
  it("swaps the chart", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    expect(title(container)).toBe("Weekly volume");
    fireEvent.change(select(container), { target: { value: "hrv" } });
    expect(title(container)).toBe("HRV");
  });

  it("LEAVES THE WINDOW WHERE IT IS", () => {
    /* Comparing two series over the same dates is the whole reason a reader
     * switches; a range that re-resolved per panel would answer a different
     * question each time. */
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.click(pill(container, "All"));
    const before = dates(container).map((i) => i.value);
    fireEvent.change(select(container), { target: { value: "hrv" } });
    expect(dates(container).map((i) => i.value)).toEqual(before);
  });
});

describe("the window", () => {
  it("defaults to the last month of DATA, not to a clock", () => {
    // The newest point in SYNTH is 2026-08-15, so the month runs from 07-15 --
    // whatever day the suite is run on.
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    expect(range(container)).toContain("2026-07-15 → 2026-08-15");
    expect(range(container)).toContain("2 of 3 points");
  });

  it("widens to the whole span on `All`", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.click(pill(container, "All"));
    expect(range(container)).toContain("2026-01-05 → 2026-08-15");
    expect(range(container)).toContain("3 of 3 points");
  });

  it("marks the preset that is showing", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    expect(pill(container, "1 month").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pill(container, "6 months"));
    expect(pill(container, "6 months").getAttribute("aria-pressed")).toBe("true");
    expect(pill(container, "1 month").getAttribute("aria-pressed")).toBe("false");
  });

  it("drops to `custom` when a date is typed, marking NO preset", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.change(dates(container)[0], { target: { value: "2026-02-01" } });
    expect(range(container)).toContain("2026-02-01 → 2026-08-15");
    expect(
      [...container.querySelectorAll("button.tab")].filter(
        (b) => b.getAttribute("aria-pressed") === "true",
      ),
    ).toHaveLength(0);
  });

  it("says a window holds nothing rather than drawing a blank plot", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.change(dates(container)[1], { target: { value: "2020-01-01" } });
    expect(container.querySelector("svg.chart")).toBeNull();
    expect(container.querySelector(".empty-state")!.textContent).toContain(
      "No points in this range",
    );
    expect(range(container)).toContain("0 of 3 points");
  });

  it("recovers from an empty window when the dates move back", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.change(dates(container)[1], { target: { value: "2020-01-01" } });
    fireEvent.click(pill(container, "All"));
    expect(container.querySelector("svg.chart")).toBeTruthy();
    expect(range(container)).toContain("3 of 3 points");
  });
});

describe("a year of the real record", () => {
  /* The window the athlete was reading on 2026-08-21, when the axis carried
   * four labels between them and the wash hung below the zero rule. */
  const year = () => {
    const r = wrap(<TrendsView payload={D!} />);
    fireEvent.click(pill(r.container, "1 year"));
    return r.container;
  };
  const labels = (c: HTMLElement) =>
    [...c.querySelectorAll("text.axis-label")].map((t) => t.textContent!);

  has(D)("labels the x axis on month boundaries, with the year", () => {
    const c = year();
    const x = labels(c).filter((t) => /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(t));
    expect(x.length).toBeGreaterThan(8);
    expect(x).toContain("1/5/26");
  });

  has(D)("rules the y axis at more than two values", () => {
    const c = year();
    const y = labels(c).filter((t) => t.endsWith(" mi"));
    expect(y.length).toBeGreaterThan(4);
    expect(y).toContain("0.0 mi");
  });

  has(D)("closes the wash on the axis", () => {
    const c = year();
    const base = parseFloat(
      c.querySelector("line.baseline")!.getAttribute("y1")!,
    );
    const wash = [...c.querySelectorAll("path")].find(
      (p) => p.getAttribute("fill") && !p.classList.contains("series-line"),
    )!;
    const corners = [...wash.getAttribute("d")!.matchAll(/L[\d.-]+ ([\d.-]+)/g)]
      .map((m) => parseFloat(m[1]))
      .slice(-2);
    for (const y of corners) expect(y).toBeCloseTo(base, 5);
  });

  has(D)("draws the layoff at zero rather than a line across it", () => {
    /* 2026-03-16 through 04-06 are lived weeks with no running in them. The
     * chart drew a straight segment over the whole month until 2026-08-21. */
    const c = year();
    const floors = [...c.querySelectorAll("circle.marker")].filter(
      (m) =>
        Math.abs(
          parseFloat(m.getAttribute("cy")!) -
            parseFloat(c.querySelector("line.baseline")!.getAttribute("y1")!),
        ) < 0.001,
    );
    expect(floors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("the pace graphs", () => {
  const pick = (title: string) => {
    const r = wrap(<TrendsView payload={D!} />);
    const select = r.container.querySelector("select")!;
    const key = trendPanels(D!).find((p) => p.title === title)!.key;
    fireEvent.change(select, { target: { value: key } });
    return r;
  };

  has(D)("offers both in the graph picker", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    const options = [...container.querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toContain("Projected race times");
    expect(options).toContain("Target paces");
  });

  has(D)("draws projected race times with every distance ticked", () => {
    const { container } = pick("Projected race times");
    // The series boxes only: the Races toggle is a checkbox too, and it is not
    // a distance.
    const boxes = [
      ...container.querySelectorAll<HTMLInputElement>(".series-picker input[type=checkbox]"),
    ];
    expect(boxes.length).toBeGreaterThan(4);
    expect(boxes.every((b) => b.checked)).toBe(true);
    expect(container.querySelectorAll("path.series-line").length).toBe(boxes.length);
  });

  has(D)("labels each panel's marks toggle with its own word", () => {
    const races = pick("Projected race times");
    expect(races.q.getByRole("checkbox", { name: "Races" })).toBeTruthy();
    cleanup();
    /* "Runs" and not "Workouts": since 2026-08-26 the Easy / recovery group's
       dots are continuous runs, and on that group they are the only dots. */
    const runs = pick("Target paces");
    expect(runs.q.getByRole("checkbox", { name: "Runs" })).toBeTruthy();
  });

  has(D)("DRAWS THE RACE EFFORTS as standalone dots, and the toggle hides them", () => {
    /* The athlete's ruling: races don't go on lines, they just get points on
       the chart -- so the dots wear the neutral race colour, not a series', and
       survive whatever the legend's boxes do. Widen to the full window so the
       committed races are in view. */
    const r = pick("Projected race times");
    const all = [
      ...r.container.querySelectorAll<HTMLButtonElement>(".range-presets button"),
    ].find((b) => b.textContent === "All")!;
    fireEvent.click(all);
    const raceDots = () =>
      [...r.container.querySelectorAll("circle.marker")].filter(
        (d) => d.getAttribute("fill") === "var(--text-primary)",
      );
    expect(raceDots().length).toBeGreaterThanOrEqual(10);
    fireEvent.click(r.q.getByRole("checkbox", { name: "Races" }));
    expect(raceDots()).toHaveLength(0);
  });

  has(D)("draws target paces as a wash BETWEEN TWO DASHED EDGES per zone", () => {
    const { container } = pick("Target paces");
    // The series boxes only: the Runs toggle is a checkbox too, and it is not
    // a zone.
    const boxes = [...container.querySelectorAll(".series-picker input[type=checkbox]")];
    expect(boxes.length).toBeGreaterThan(1);
    // The wash is context at the spec 10%; the two edges are what carry the
    // zone's identity, and they say where it STOPS -- which a rule down the
    // middle never did. Replaced 2026-08-25, athlete's call.
    expect(container.querySelectorAll("path[opacity='0.1']").length).toBe(boxes.length);
    expect(container.querySelectorAll("path.series-edge").length).toBe(2 * boxes.length);
    // NO solid stroke at all on this panel: every series here is a band, and a
    // solid stroke now means a scalar line or an executed workout.
    expect(container.querySelectorAll("path.series-line").length).toBe(0);
  });

  has(D)("groups the target paces, and opens on the sub-threshold ladder", () => {
    const { container } = pick("Target paces");
    const sel = [...container.querySelectorAll<HTMLSelectElement>("select")].find((x) =>
      x.closest("label")?.textContent?.includes("Paces"),
    )!;
    expect([...sel.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      "Tempo & repetition",
      "Sub-threshold",
      "Easy / recovery",
    ]);
    expect(sel.value).toBe("subt");
  });

  has(D)("SWAPS THE ZONES when the group changes, window untouched", () => {
    const { container } = pick("Target paces");
    const sel = [...container.querySelectorAll<HTMLSelectElement>("select")].find((x) =>
      x.closest("label")?.textContent?.includes("Paces"),
    )!;
    const window = container.querySelector(".sm-range")!.textContent;
    fireEvent.change(sel, { target: { value: "speed" } });
    const names = [...container.querySelectorAll(".series-picker .series-item")].map(
      (x) => x.textContent,
    );
    expect(names).toEqual(["Repetition", "Tempo"]);
    expect(container.querySelector(".sm-range")!.textContent).toBe(window);
  });

  has(D)("DRAWS THE EASY RUNS on the Easy / recovery group, and the toggle hides them", () => {
    /* The group carried a band and no dots until 2026-08-26. Its marks are
       KEYED, so they wear the zone's colour rather than a colour of their own
       -- which is why they are counted here as every marker on the plot, and
       why unticking Easy in the case below takes a share of them away. */
    const { container, q } = pick("Target paces");
    const sel = [...container.querySelectorAll<HTMLSelectElement>("select")].find((x) =>
      x.closest("label")?.textContent?.includes("Paces"),
    )!;
    fireEvent.change(sel, { target: { value: "easy" } });
    const dots = () => container.querySelectorAll("circle.marker");
    expect(dots().length).toBeGreaterThan(0);
    fireEvent.click(q.getByRole("checkbox", { name: "Runs" }));
    expect(dots()).toHaveLength(0);
  });

  has(D)("TAKES THE LONG RUNS WITH EASY when Easy is unticked", () => {
    /* The athlete's ruling that a long run is drawn as an easy run, seen from
       the render side: the dots are keyed to the Easy series, so the series
       tick governs them. Recovery's dots stay. */
    const { container } = pick("Target paces");
    const sel = [...container.querySelectorAll<HTMLSelectElement>("select")].find((x) =>
      x.closest("label")?.textContent?.includes("Paces"),
    )!;
    fireEvent.change(sel, { target: { value: "easy" } });
    const dots = () => container.querySelectorAll("circle.marker").length;
    const before = dots();
    const easy = [
      ...container.querySelectorAll<HTMLElement>(".series-picker .series-item"),
    ].find((x) => x.textContent === "Easy")!;
    fireEvent.click(easy.querySelector("input")!);
    const after = dots();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  has(D)("offers no group dropdown on the race panel", () => {
    const { container } = pick("Projected race times");
    expect(
      [...container.querySelectorAll("select")].some((x) =>
        x.closest("label")?.textContent?.includes("Paces"),
      ),
    ).toBe(false);
  });

  has(D)("offers a unit toggle on race times and none on target paces", () => {
    expect(pick("Projected race times").container.querySelector(".unit-toggle")).toBeTruthy();
    cleanup();
    expect(pick("Target paces").container.querySelector(".unit-toggle")).toBeNull();
  });

  has(D)("RESETS THE TICKS WHEN THE GRAPH CHANGES, because the series differ", () => {
    const { container } = pick("Projected race times");
    const select = container.querySelector("select")!;
    const first = container.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    fireEvent.click(first);
    expect(
      container.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked,
    ).toBe(false);

    const bands = trendPanels(D!).find((p) => p.title === "Target paces")!.key;
    fireEvent.change(select, { target: { value: bands } });
    const boxes = [...container.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  has(D)("KEEPS THE WINDOW ACROSS THE SWITCH -- it is shared, and deliberately", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    const before = container.querySelector(".sm-range")!.textContent!.split("·")[0];
    const key = trendPanels(D!).find((p) => p.title === "Target paces")!.key;
    fireEvent.change(container.querySelector("select")!, { target: { value: key } });
    expect(container.querySelector(".sm-range")!.textContent!.split("·")[0]).toBe(before);
  });

  has(D)("does not let the pace panels move the default window", () => {
    /* They reach back to 2024-12-29, earlier than any other series, and the
       default preset resolves against the newest date rather than the oldest --
       so adding them must not have shifted where the page opens. */
    const range = defaultRange(trendPanels(D!))!;
    const newest = trendPanels(D!)
      .flatMap((p) => p.points)
      // `!p.carried`: the live-week extension restates the newest chart under
      // a Sunday still ahead, and it must not anchor the window either -- the
      // invariant this case exists to hold.
      .filter((p) => !p.carried && (p.value !== null || p.values))
      .map((p) => p.date)
      .sort();
    expect(range.to).toBe(newest[newest.length - 1]);
  });

  has(D)("SHOWS A LIVE-WEEK WORKOUT at the default window -- the 2026-08-25 case", () => {
    /* The mark that started this: run two days after the newest confirmed
       chart and invisible until the carried segment existed. The caption's To
       still reads the newest MEASUREMENT -- the axis reaching one Sunday past
       it is the Calendar's whole-weeks rule, not a moved window. Durable in
       both tree states: once the week's own chart lands, the mark is in-span
       ordinarily. */
    const { container } = pick("Target paces");
    expect(container.querySelector(".sm-range")!.textContent).toContain(
      `→ ${defaultRange(trendPanels(D!))!.to}`,
    );
    const seen: string[] = [];
    for (const dot of container.querySelectorAll("circle.marker")) {
      fireEvent.mouseEnter(dot.closest("g")!, { clientX: 1, clientY: 1 });
      seen.push(document.body.textContent ?? "");
      fireEvent.mouseLeave(dot.closest("g")!);
    }
    expect(seen.some((t) => t.includes("2026-08-25"))).toBe(true);
  });
});
