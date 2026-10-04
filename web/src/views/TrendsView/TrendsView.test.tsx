import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { clock } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { modelRacePaces } from "@/lib/pacemodels/tables";
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
/** The window-length dropdown. NOT `select(c)`, which is the graph picker and
 *  is deliberately first in the row. */
const presets = (c: HTMLElement) =>
  c.querySelector<HTMLSelectElement>(".field.trailing select")!;
/** Choose a preset by its visible label, so a case reads as the reader's act. */
const choose = (c: HTMLElement, label: string) => {
  const option = [...presets(c).options].find((o) => o.textContent === label)!;
  fireEvent.change(presets(c), { target: { value: option.value } });
};
const dates = (c: HTMLElement) =>
  [...c.querySelectorAll('input[type="date"]')] as HTMLInputElement[];
/** The arrows in DOM order: coarse back, fine back, fine forward, coarse
 *  forward. */
const arrows = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLButtonElement>(".stepper button")];

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

describe("the aggregation controls", () => {
  const aggSelects = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLSelectElement>(".agg-controls select")];

  /** Two whole Mon-Sun weeks with dated runs, so the ledgers have days. */
  const AGG = {
    weeks: {
      "2026-07-20": {
        adherence: {
          results: [{ date: "2026-07-21", role: "easy", miles: 30, seconds: 15000 }],
          facts: { miles: 30, elapsed_days: 7 },
          scores: { week: { pct: 90 } },
        },
      },
      "2026-07-27": {
        adherence: {
          results: [{ date: "2026-07-28", role: "easy", miles: 40, seconds: 20000 }],
          facts: { miles: 40, elapsed_days: 7 },
          scores: { week: { pct: 90 } },
        },
      },
    },
    days: [],
    history: {},
  } as unknown as Payload;

  has(D)("appear on the volume graph and not on a wellness one", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    // Volume is the first panel, so the page opens on it.
    expect(aggSelects(container)).toHaveLength(2);
    fireEvent.change(select(container), { target: { value: "rhr" } });
    // A monthly total of a resting heart rate is not a quantity.
    expect(aggSelects(container)).toHaveLength(0);
  });

  has(D)("keep the aggregation across a graph switch -- shared like the window", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    fireEvent.change(aggSelects(container)[0], { target: { value: "rolling" } });
    fireEvent.change(aggSelects(container)[1], { target: { value: "monthly" } });
    fireEvent.change(select(container), { target: { value: "load" } });
    expect(aggSelects(container).map((s) => s.value)).toEqual(["rolling", "monthly"]);
    // Detouring through a panel with no controls does not lose it either.
    fireEvent.change(select(container), { target: { value: "rhr" } });
    fireEvent.change(select(container), { target: { value: "quality" } });
    expect(aggSelects(container).map((s) => s.value)).toEqual(["rolling", "monthly"]);
  });

  has(D)("DO NOT MOVE THE WINDOW when the aggregation changes", () => {
    /* The window is resolved against the BASE panels; re-resolving it per
       aggregation would answer a different question after every switch. */
    const { container } = wrap(<TrendsView payload={D!} />);
    const before = dates(container).map((i) => i.value);
    fireEvent.change(aggSelects(container)[0], { target: { value: "rolling" } });
    expect(dates(container).map((i) => i.value)).toEqual(before);
    fireEvent.change(aggSelects(container)[1], { target: { value: "yearly" } });
    expect(dates(container).map((i) => i.value)).toEqual(before);
  });

  it("retitle the drawn panel period-free; the picker keeps the series name", () => {
    const { container } = wrap(<TrendsView payload={AGG} />);
    expect(title(container)).toBe("Weekly volume");
    fireEvent.change(aggSelects(container)[1], { target: { value: "monthly" } });
    // "Weekly volume" over a monthly bucket would be wrong on its face.
    expect(title(container)).toBe("Volume");
    const offered = [...select(container).querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(offered).toContain("Weekly volume");
  });

  it("draw the rolling series at day resolution over the full record", () => {
    const { container } = wrap(<TrendsView payload={AGG} />);
    fireEvent.change(aggSelects(container)[0], { target: { value: "rolling" } });
    // 14 covered days hold eight 7-day windows -- computed from the FULL
    // record, so the count is 8 whatever the window shows.
    expect(range(container)).toContain("of 8 points");
  });

  it("return to the identity series when the defaults are re-chosen", () => {
    const { container } = wrap(<TrendsView payload={AGG} />);
    const before = range(container);
    fireEvent.change(aggSelects(container)[0], { target: { value: "rolling" } });
    fireEvent.change(aggSelects(container)[0], { target: { value: "boundaries" } });
    expect(range(container)).toBe(before);
    expect(title(container)).toBe("Weekly volume");
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
    choose(container, "All");
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
    choose(container, "All");
    expect(range(container)).toContain("2026-01-05 → 2026-08-15");
    expect(range(container)).toContain("3 of 3 points");
  });

  it("shows the preset that is showing", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    expect(presets(container).value).toBe("1m");
    choose(container, "6 months");
    expect(presets(container).value).toBe("6m");
  });

  it("drops to `custom` when a date is typed", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.change(dates(container)[0], { target: { value: "2026-02-01" } });
    expect(range(container)).toContain("2026-02-01 → 2026-08-15");
    expect(presets(container).value).toBe("custom");
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
    choose(container, "All");
    expect(container.querySelector("svg.chart")).toBeTruthy();
    expect(range(container)).toContain("3 of 3 points");
  });
});

describe("the WEEK arrows, which work where the preset arrows will not", () => {
  /* The athlete asked for arrows that *"only move the calendar by a week instead
   * of the selected amount of time showing"*, on this page as well as the
   * Calendar. `TrendsView` owns what a week-step does to the LABEL. */

  const back = (c: HTMLElement) => fireEvent.click(arrows(c)[1]);
  const forward = (c: HTMLElement) => fireEvent.click(arrows(c)[2]);

  it("moves the window seven days and KEEPS a length preset", () => {
    /* `1 month` names the window's LENGTH, not its position, and a week-step
     * preserves it -- the same reason a period-step keeps it. */
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    expect(range(container)).toContain("2026-07-15 → 2026-08-15");
    back(container);
    expect(range(container)).toContain("2026-07-08 → 2026-08-08");
    expect(presets(container).value).toBe("1m");
  });

  it("steps repeatedly without drifting", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    for (let i = 0; i < 3; i += 1) back(container);
    expect(range(container)).toContain("2026-06-24 → 2026-07-25");
    for (let i = 0; i < 3; i += 1) forward(container);
    expect(range(container)).toContain("2026-07-15 → 2026-08-15");
  });

  it("IS LIVE ON `All`, where the preset arrows are dead", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    choose(container, "All");
    const [coarseBack, fineBack, fineFwd, coarseFwd] = arrows(container);
    expect([coarseBack.disabled, coarseFwd.disabled]).toEqual([true, true]);
    expect([fineBack.disabled, fineFwd.disabled]).toEqual([false, false]);
  });

  it("DROPS `All` TO `Custom`, because the window is no longer all the data", () => {
    /* The one preset a step cannot survive: `All` claims the window IS the
     * record, which stops being true the moment it moves. */
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    choose(container, "All");
    expect(range(container)).toContain("2026-01-05 → 2026-08-15");
    back(container);
    expect(presets(container).value).toBe("custom");
    expect(range(container)).toContain("2025-12-29 → 2026-08-08");
  });

  it("stays in `custom` and still moves", () => {
    const { container } = wrap(<TrendsView payload={SYNTH} />);
    fireEvent.change(dates(container)[0], { target: { value: "2026-02-01" } });
    expect(presets(container).value).toBe("custom");
    forward(container);
    expect(presets(container).value).toBe("custom");
    expect(range(container)).toContain("2026-02-08 → 2026-08-22");
  });
});

describe("a year of the real record", () => {
  /* The window the athlete was reading on 2026-08-21, when the axis carried
   * four labels between them and the wash hung below the zero rule. */
  const year = () => {
    const r = wrap(<TrendsView payload={D!} />);
    choose(r.container, "1 year");
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
    choose(r.container, "All");
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
      "Threshold & repetition",
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
    expect(names).toEqual(["Repetition", "Threshold"]);
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
    /* The mark that started this was 2026-08-25's: run two days after the
       newest confirmed chart and invisible until the carried segment existed.
       The caption's To still reads the newest MEASUREMENT -- the axis reaching
       one Sunday past it is the Calendar's whole-weeks rule, not a moved window.

       THE LIVE-WEEK MARKS ARE FOUND, NOT NAMED. This case pinned "2026-08-25"
       and failed on 2026-09-27 for no fault in the component: the default
       window is the LAST MONTH, so any hard-coded date slides out of it. A
       live-week mark is one dated after the newest confirmed (non-carried)
       chart, and every one of them must be hoverable at the default window.
       NOT every in-window mark: this panel plots weekly, so a mark dated
       before the window's first week-start slot has nowhere to land -- that is
       the slot rule, not this case's subject. On a Monday before the live
       week's first session `live` is empty and only the sanity floor holds. */
    const panel = trendPanels(D!).find((p) => p.title === "Target paces")!;
    const window = defaultRange(trendPanels(D!))!;
    const confirmed = panel.points
      .filter((p) => !p.carried)
      .map((p) => p.date)
      .sort()
      .at(-1)!;
    const inWindow = (panel.marks ?? []).filter(
      (m) => m.date >= window.from && m.date <= window.to,
    );
    const live = inWindow.filter((m) => m.date > confirmed);
    expect(inWindow.length).toBeGreaterThan(0);

    const { container } = pick("Target paces");
    expect(container.querySelector(".sm-range")!.textContent).toContain(`→ ${window.to}`);
    const seen: string[] = [];
    for (const dot of container.querySelectorAll("circle.marker")) {
      fireEvent.mouseEnter(dot.closest("g")!, { clientX: 1, clientY: 1 });
      seen.push(document.body.textContent ?? "");
      fireEvent.mouseLeave(dot.closest("g")!);
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const m of live) {
      expect(seen.some((t) => t.includes(m.date)), m.date).toBe(true);
    }
  });
});

describe("TrendsView, the paces rail", () => {
  /* THE RAIL SITS BESIDE EVERY PAGE since 2026-09-06. This one is about no week
   * in particular, so it shows the CURRENT chart and no week column at all. */

  has(D)("renders beside the card, with no week column", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    const rail = container.querySelector(".page-layout > .rail")!;
    expect(rail).toBeTruthy();
    expect(rail.querySelector("h2")!.textContent).toBe("Paces");
    expect(rail.textContent).toContain("Current");
    /* A column of dashes headed "This week" would invent a week this page does
       not have -- which is a different state from a week whose chart has not
       been confirmed, and reads as a measurement that went missing. */
    expect(rail.textContent).not.toContain("This week");
  });

  has(D)("leaves the graph in the main column", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(container.querySelector(".page-main > .card")).toBeTruthy();
    expect(container.querySelector(".page-main .rail")).toBeNull();
  });

  it("renders beside the EMPTY card too", () => {
    // The no-panels branch is its own return, and a rail that appeared on one
    // of the two would be a layout that depends on whether there is data.
    const { container } = wrap(
      <TrendsView payload={{ weeks: {}, days: [] } as unknown as Payload} />,
    );
    expect(container.querySelector(".page-main > .card")).toBeTruthy();
  });
});

/* ------------------------------------------------ the effective VO2max graph */

describe("the effective VO2max graph", () => {
  const pick = () => {
    const r = wrap(<TrendsView payload={D!} />);
    fireEvent.change(r.container.querySelector("select")!, { target: { value: "vo2max" } });
    return r;
  };
  const seriesNames = (c: HTMLElement) =>
    [...c.querySelectorAll(".series-picker .series-item")].map((e) => e.textContent);
  const box = (c: HTMLElement) => c.querySelector<HTMLInputElement>("input.window-days")!;
  const type = (c: HTMLElement, text: string) => {
    fireEvent.change(box(c), { target: { value: text } });
    fireEvent.keyDown(box(c), { key: "Enter" });
  };
  const tipRows = () =>
    [...document.body.querySelectorAll(".tooltip .row")].map((r) => r.textContent!);
  const LABELS = ["800m", "1500m", "3000m", "5000m", "10000m", "Half marathon", "Marathon"];

  has(D)("is offered in the picker, ahead of the two pace panels", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    // The GRAPH picker's options only; the page has four other selects.
    const options = [...select(container).querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    const at = options.indexOf("Effective VO2max");
    expect(at).toBeGreaterThan(-1);
    expect(options.slice(at)).toEqual([
      "Effective VO2max",
      "Projected race times",
      "Target paces",
    ]);
  });

  has(D)("opens on the athlete's 42 d and the model's 30 d, both ticked", () => {
    const { container } = pick();
    expect(title(container)).toBe("Effective VO2max");
    expect(seriesNames(container)).toEqual(["42 d", "30 d"]);
    expect(container.querySelectorAll("path.series-line").length).toBeGreaterThan(0);
  });

  has(D)("offers the window box HERE and on no other graph", () => {
    const { container } = pick();
    expect(box(container)).toBeTruthy();
    for (const p of trendPanels(D!)) {
      if (p.key === "vo2max") continue;
      fireEvent.change(container.querySelector("select")!, { target: { value: p.key } });
      expect(container.querySelector("input.window-days"), p.key).toBeNull();
    }
  });

  has(D)("ADDS A THIRD LINE at the typed window, and keeps the first two", () => {
    const { container } = pick();
    type(container, "60");
    expect(seriesNames(container)).toEqual(["42 d", "30 d", "60 d"]);
    expect(container.querySelectorAll("path.series-line").length).toBeGreaterThanOrEqual(3);
  });

  has(D)("removes it again on a cleared or invalid entry", () => {
    const { container } = pick();
    type(container, "60");
    type(container, "");
    expect(seriesNames(container)).toEqual(["42 d", "30 d"]);
    type(container, "60");
    type(container, "never");
    expect(seriesNames(container)).toEqual(["42 d", "30 d"]);
  });

  has(D)("does not add a duplicate of a line already drawn", () => {
    const { container } = pick();
    type(container, "30");
    expect(seriesNames(container)).toEqual(["42 d", "30 d"]);
  });

  has(D)("keeps the typed window through a detour to another graph", () => {
    /* The state rides above the `key={panel.key}` remount, beside the
       aggregation, for the same reason. */
    const { container } = pick();
    type(container, "90");
    fireEvent.change(container.querySelector("select")!, { target: { value: "volume" } });
    expect(title(container)).toBe("Weekly volume");
    fireEvent.change(container.querySelector("select")!, { target: { value: "vo2max" } });
    expect(seriesNames(container)).toEqual(["42 d", "30 d", "90 d"]);
    expect(box(container).value).toBe("90");
  });

  has(D)("DOES NOT MOVE THE DATE WINDOW when a line is added", () => {
    const { container } = pick();
    const before = range(container);
    type(container, "120");
    expect(range(container)).toBe(before);
    const want = defaultRange(trendPanels(D!))!;
    expect(dates(container).map((i) => i.value)).toEqual([want.from, want.to]);
  });

  has(D)("lists a projected time per window for every rail distance on hover", () => {
    const { container } = pick();
    type(container, "60");
    choose(container, "All");
    const hits = [...container.querySelectorAll("rect[fill='transparent']")];
    expect(hits.length).toBeGreaterThan(100);
    fireEvent.mouseEnter(hits[hits.length - 1], { clientX: 1, clientY: 1 });
    const rows = tipRows();
    expect(rows.some((r) => r.startsWith("Projected42 d · 30 d · 60 d"))).toBe(true);
    for (const label of LABELS) {
      const row = rows.find((r) => r.startsWith(label))!;
      expect(row, label).toBeTruthy();
      // Three clock values, one per window, e.g. `18:06 · 18:12 · 18:20`.
      expect(row.slice(label.length).split(" · ")).toHaveLength(3);
      expect(row.slice(label.length)).toMatch(/^(\d+:)?\d+:\d\d( · (\d+:)?\d+:\d\d){2}$/);
    }
  });

  has(D)("prices the 42 d column through the function the rail's dropdown column uses", () => {
    /* The rail's own anchor is the CONFIRMED chart's, a Sunday, so the two
       agree only where the curve's day IS that Sunday. This compares the same
       function at the same number instead, which is the contract.

       THE NUMBER COMES FROM THE PANEL, NOT BACK OUT OF THE TOOLTIP. The tooltip
       shows the anchor to two decimals and prices the UNROUNDED value, so
       re-pricing the display agrees only while no rounding crosses a clock
       second -- on 2026-09-25 it did (59.2769 prices a 5k at 17:14, 59.28 at
       17:13). The display is still read, to tie the hovered day to this point. */
    const { container } = pick();
    choose(container, "All");
    const hits = [...container.querySelectorAll("rect[fill='transparent']")];
    fireEvent.mouseEnter(hits[hits.length - 1], { clientX: 1, clientY: 1 });
    const rows = tipRows();
    const points = trendPanels(D!).find((p) => p.key === "vo2max")!.points;
    const anchor = points[points.length - 1].values!.w42 as number;
    const shown = Number(rows.find((r) => r.startsWith("42 d"))!.slice(4));
    expect(Math.abs(shown - anchor)).toBeLessThanOrEqual(0.005 + 1e-9);
    const table = modelRacePaces("daniels_gilbert", anchor)!;
    const five = rows.find((r) => r.startsWith("5000m"))!.slice(5).split(" · ")[0];
    expect(five).toBe(clock(table["5000m"].seconds!));
  });
});
