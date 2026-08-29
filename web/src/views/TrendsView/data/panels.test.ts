import { describe, expect, it } from "vitest";

import { shortDate } from "@/lib/data/format";
import type { Payload, Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { dayIndex } from "./dates";
import { type TrendPoint, drawn, trendPanels } from "./panels";

const week = (over: Partial<Week>): Week => over as Week;

const payload = (over: Partial<Payload>): Payload =>
  ({ weeks: {}, days: [], history: {}, ...over }) as unknown as Payload;

/** An adherence half for a week that WAS run. `results` is what says so. */
const A = (pct: number | null, facts: Record<string, unknown> = {}) =>
  ({
    scores: { week: { pct } },
    facts,
    results: [{ id: 1 }],
  }) as unknown as Week["adherence"];

/** A week the plan describes and nobody has run: real record, no measurements.
 *  This is what `published/weeks/2026-08-17` actually holds. */
const PLANNED = {
  scores: { week: { pct: null, earned: 0, total: 0 } },
  facts: { miles: 0, quality_share: 0 },
  results: [],
} as unknown as Week["adherence"];

const L = (over: Record<string, unknown>) =>
  ({ flags: [], days: [{ date: "2026-07-27" }], ...over }) as unknown as Week["load"];

const keys = (p: Payload) => trendPanels(p).map((x) => x.key);
const panel = (p: Payload, key: string) => trendPanels(p).find((x) => x.key === key)!;

describe("trendPanels", () => {
  it("is empty when there is nothing to plot", () => {
    // An empty plot states that a measurement exists and is flat.
    expect(trendPanels(payload({}))).toEqual([]);
  });

  it("plots weekly volume from each week's MEASURED miles", () => {
    /* It read `history.json.weeks` until 2026-08-15 -- hand-authored, and it
     * stopped at 07-27 while the athlete was running 8/3 and 8/10, so the chart
     * simply ended a fortnight short and said nothing about it. */
    const p = payload({
      weeks: {
        "2026-07-20": week({ adherence: A(90, { miles: 46.31 }) }),
        "2026-07-27": week({ adherence: A(88, { miles: 50.3 }) }),
      },
    });
    expect(panel(p, "volume").points.map((pt) => pt.value)).toEqual([46.31, 50.3]);
  });

  it("READS NOTHING FROM history.json", () => {
    // It is a hand-authored record with no reader on the page any more.
    const p = payload({
      history: {
        weeks: { "2026-06-22": { miles: 38.1 } },
        resting_hr_weekly_mean: { "2026-06-22": 47 },
      },
    });
    expect(trendPanels(p)).toEqual([]);
  });

  it("sorts every series chronologically", () => {
    const p = payload({
      weeks: {
        "2026-08-03": week({ adherence: A(90, { miles: 50 }) }),
        "2026-07-20": week({ adherence: A(90, { miles: 40 }) }),
      },
    });
    expect(panel(p, "volume").points.map((pt) => pt.value)).toEqual([40, 50]);
  });

  it("colours by DOMAIN, not by panel", () => {
    // Blue is adherence, orange is load, green is wellness.
    const p = payload({
      weeks: {
        "2026-07-27": week({ adherence: A(90), load: L({ acwr_mech: 1.1 }) }),
      },
      days: [
        { date: "2026-07-27", hrv: "85", resting_hr: "44" },
      ] as unknown as Payload["days"],
    });
    const by = Object.fromEntries(trendPanels(p).map((x) => [x.key, x.color]));
    expect(by.adherence).toBeUndefined(); // the LineChart default, series-1
    expect(by.acwr).toBe("var(--series-2)");
    expect(by.hrv).toBe("var(--series-3)");
    expect(by.rhr).toBe("var(--series-3)");
  });

  it("marks 1.30 as the A:C danger line", () => {
    const p = payload({
      weeks: { "2026-07-27": week({ load: L({ acwr_mech: 1.1 }) }) },
    });
    expect(panel(p, "acwr").reference).toBe(1.3);
  });

  it("STATES NO DESCRIPTION OR OMISSION", () => {
    /* `sub` was the dimmed line under the title and the athlete asked for it to
     * go on 2026-08-15 -- the third instruction of its kind. The omissions it
     * carried still HAPPEN; the page no longer says so, and they are reported in
     * conversation instead. */
    const p = payload({
      weeks: { "2026-07-27": week({ adherence: A(90, { miles: 50 }) }) },
    });
    for (const x of trendPanels(p)) {
      expect(x).not.toHaveProperty("sub");
    }
  });
});

describe("a week nobody has run", () => {
  /* The plan reaches two Mondays ahead, and `published/weeks/2026-08-17` is a
   * real record: `facts.miles` 0.0, `facts.quality_share` 0,
   * `integrity.total` 0. Every one of those is a good number and none is a
   * measurement -- plotted, they read as a collapse in training, which is what
   * the athlete saw on the live page. */

  const p = payload({
    weeks: {
      "2026-08-10": week({
        adherence: A(93, { miles: 43.08, quality_share: 0.11 }),
        load: L({
          integrity: { total: 158474 },
          acwr_mech: 1.09,
          days: [{ date: "2026-08-10" }],
        }),
      }),
      "2026-08-17": week({
        adherence: PLANNED,
        load: L({ integrity: { total: 0 }, acwr_mech: null, days: [] }),
      }),
    },
  });

  it.each(["volume", "adherence", "quality"])(
    "leaves it out of the %s series",
    (key) => {
      expect(panel(p, key).points.map((pt) => pt.date)).toEqual(["2026-08-10"]);
    },
  );

  it("leaves it out of the total-load series, which would read as a zero week", () => {
    expect(panel(p, "load").points.map((pt) => pt.date)).toEqual(["2026-08-10"]);
  });

  it("leaves it out of the A:C series", () => {
    expect(panel(p, "acwr").points.map((pt) => pt.date)).toEqual(["2026-08-10"]);
  });

  it("omits a panel entirely when NO week has been run", () => {
    const none = payload({ weeks: { "2026-08-17": week({ adherence: PLANNED }) } });
    expect(keys(none)).toEqual([]);
  });

  it("keeps a week that WAS run but scored null", () => {
    /* Different question. A week can be under way with nothing scoreable due
     * yet, and its miles are still a measurement. */
    const live = payload({
      weeks: { "2026-08-17": week({ adherence: A(null, { miles: 12.4 }) }) },
    });
    expect(panel(live, "volume").points.map((pt) => pt.value)).toEqual([12.4]);
    expect(panel(live, "adherence").points.map((pt) => pt.value)).toEqual([null]);
  });

  it("gates load on the LOAD record, not on whether the athlete ran", () => {
    // A week can carry step data with no running in it at all.
    const walked = payload({
      weeks: {
        "2026-08-17": week({
          load: L({ integrity: { total: 40000 }, days: [{ date: "2026-08-17" }] }),
        }),
      },
    });
    expect(panel(walked, "load").points).toHaveLength(1);
    expect(keys(walked)).not.toContain("volume");
  });
});

describe("the fitness panel", () => {
  /* ONE PANEL SINCE 2026-08-27, the athlete's instruction. Daily TRIMP, CTL,
   * TSB and ATL were four picker entries showing four cuts of the same quantity
   * family, all in the TRIMP unit -- so they share one axis and the series
   * checkboxes stand in for the old picker entries. TRIMP is a line now, the
   * athlete's explicit choice over bars beside lines. */
  const day = (date: string, over: Record<string, unknown> = {}) => ({
    date,
    trimp: 90,
    bg_trimp: 5,
    ctl: 80,
    atl: 95,
    tsb: -15,
    ...over,
  });
  const withDays = (days: Record<string, unknown>[]) =>
    payload({ weeks: { "2026-07-27": week({ load: L({ days }) }) } });

  it("adds ONE combined panel when a curve is published, replacing the old four", () => {
    const got = keys(withDays([day("2026-07-27")]));
    expect(got).toContain("fitness");
    for (const old of ["trimp", "ctl", "tsb", "atl"]) {
      expect(got).not.toContain(old);
    }
  });

  it("omits it when no week carries a priced day", () => {
    const got = keys(
      payload({ weeks: { w: week({ load: L({ days: [{ date: "2026-07-27" }] }) }) } }),
    );
    expect(got).not.toContain("fitness");
  });

  it("declares the five series in reading order, coloured by CAT position", () => {
    /* The multi-series rule: colour by position in the palette's validated
     * order, never shuffled to taste. Slots 1 and 2 land on blue run / orange
     * background, the same split `CalendarCell` and `LoadPanel` encode. */
    expect(panel(withDays([day("2026-07-27")]), "fitness").series).toEqual([
      { key: "trimp", label: "TRIMP", color: "var(--cat-1)" },
      { key: "bg", label: "background", color: "var(--cat-2)" },
      { key: "ctl", label: "Fitness", color: "var(--cat-3)" },
      { key: "atl", label: "Fatigue", color: "var(--cat-4)" },
      { key: "tsb", label: "Form", color: "var(--cat-5)" },
    ]);
  });

  it("carries every quantity as a per-date value, with the scalar left null", () => {
    const pt = panel(withDays([day("2026-07-27")]), "fitness").points[0];
    expect(pt.value).toBeNull();
    expect(pt.values).toEqual({ trimp: 90, bg: 5, ctl: 80, atl: 95, tsb: -15 });
  });

  it("keeps the zero reference the old Form panel stated -- TSB is a difference", () => {
    expect(panel(withDays([day("2026-07-27")]), "fitness").reference).toBe(0);
  });

  it("KEEPS a pre-convergence day, with fitness and form as gaps in their lines", () => {
    /* The 42-day average has not yet forgotten its zero seed, so CTL and TSB
     * are withheld while TRIMP and ATL publish. The old CTL panel DROPPED the
     * date; on the union point set it stays, and the two lines start later. */
    const p = withDays([day("2026-07-27", { ctl: null, tsb: null }), day("2026-07-28")]);
    const pts = panel(p, "fitness").points;
    expect(pts.map((pt) => pt.date)).toEqual(["2026-07-27", "2026-07-28"]);
    expect(pts[0].values).toEqual({ trimp: 90, bg: 5, ctl: null, atl: 95, tsb: null });
  });

  it("drops a checkbox for a quantity NO day ever measured, and closes the colour gap", () => {
    /* A series that would draw nothing offers a tick that does nothing. Colours
     * stay positional AFTER the filter, so no slot sits unused between two
     * drawn series. */
    const p = withDays([day("2026-07-27", { ctl: null, tsb: null })]);
    expect(panel(p, "fitness").series).toEqual([
      { key: "trimp", label: "TRIMP", color: "var(--cat-1)" },
      { key: "bg", label: "background", color: "var(--cat-2)" },
      { key: "atl", label: "Fatigue", color: "var(--cat-3)" },
    ]);
  });

  it("keeps a day whose background was never measured, as a null in that one series", () => {
    // 2026-08-15 is exactly this: 32.99 of running impulse, no background row.
    const p = withDays([day("2026-08-15", { trimp: 32.99, bg_trimp: null })]);
    expect(panel(p, "fitness").points[0].values).toMatchObject({
      trimp: 32.99,
      bg: null,
    });
  });

  it("keeps a REST day, whose zero is a measurement", () => {
    const p = withDays([day("2026-07-27", { trimp: 0 })]);
    expect(panel(p, "fitness").points[0].values).toMatchObject({ trimp: 0 });
  });
});

describe("the partly-covered week", () => {
  const incomplete = L({
    integrity: { total: 40000 },
    days: [{ date: "2026-07-27" }],
    flags: [{ token: "steps-data-incomplete", status: "fired", why: "" }],
  });
  const complete = (total: number) =>
    L({ integrity: { total }, days: [{ date: "2026-07-20" }] });

  it("is DROPPED from the total-load trend", () => {
    /* It sums fewer days, so plotting its total beside full weeks reads as a
     * collapse in training. The drop is unchanged; the sentence that stated it
     * went with `sub` on 2026-08-15. */
    const p = payload({
      weeks: {
        "2026-07-20": week({ load: complete(120000) }),
        "2026-07-27": week({ load: incomplete }),
      },
    });
    expect(panel(p, "load").points).toHaveLength(1);
    expect(panel(p, "load").points[0].value).toBe(120000);
  });

  it("omits the load panel entirely when EVERY week is partly covered", () => {
    const p = payload({ weeks: { "2026-07-27": week({ load: incomplete }) } });
    expect(keys(p)).not.toContain("load");
  });

  it("still plots it on the A:C panel, which is not a sum", () => {
    // A:C is a ratio the grader computed; the omission rule is about summing
    // fewer days, so it does not apply here.
    const p = payload({
      weeks: {
        "2026-07-27": week({
          load: L({
            acwr_mech: 1.2,
            days: [{ date: "2026-07-27" }],
            flags: [{ token: "steps-data-incomplete", status: "fired", why: "" }],
          }),
        }),
      },
    });
    expect(panel(p, "acwr").points).toHaveLength(1);
  });
});

describe("the wellness series", () => {
  it("plots resting heart rate DAILY", () => {
    /* It was a weekly mean off `history.json` until 2026-08-15 -- seven numbers
     * ending 08-03, against 76 measured days ending 08-15. */
    const p = payload({
      days: [
        { date: "2026-08-14", resting_hr: "43" },
        { date: "2026-08-15", resting_hr: "44" },
      ] as unknown as Payload["days"],
    });
    expect(panel(p, "rhr").points.map((pt) => [pt.date, pt.value])).toEqual([
      ["2026-08-14", 43],
      ["2026-08-15", 44],
    ]);
  });

  it("gives resting heart rate NO reference line", () => {
    /* The athlete's baseline band is a published measurement, but the readiness
     * check is a one-sided rise rather than a band test -- an edge drawn here
     * would state a criterion nothing scores. */
    const p = payload({
      days: [{ date: "2026-08-14", resting_hr: "43" }] as unknown as Payload["days"],
    });
    expect(panel(p, "rhr").reference ?? null).toBeNull();
  });

  it("plots only the nights that have sleep data", () => {
    const p = payload({
      days: [
        { date: "2026-07-27", sleep_hours: "7.5" },
        { date: "2026-07-28", sleep_hours: "" },
      ] as unknown as Payload["days"],
    });
    expect(panel(p, "sleep").points).toHaveLength(1);
  });

  it("omits a wellness panel with no measurements at all", () => {
    const p = payload({
      days: [{ date: "2026-07-27", hrv: "" }] as unknown as Payload["days"],
    });
    expect(keys(p)).not.toContain("hrv");
  });
});

describe("over the committed payload", () => {
  it("gives every panel a unique key", () => {
    if (!PUBLISHED) return;
    const ks = keys(PUBLISHED);
    expect(new Set(ks).size).toBe(ks.length);
  });

  it("formats every panel's values without throwing", () => {
    if (!PUBLISHED) return;
    for (const p of trendPanels(PUBLISHED)) {
      for (const pt of p.points) {
        if (pt.value === null) continue;
        expect(typeof p.format(pt.value)).toBe("string");
      }
    }
  });

  it("produces panels from the real payload", () => {
    if (!PUBLISHED) return;
    expect(trendPanels(PUBLISHED).length).toBeGreaterThan(0);
  });

  it("PLOTS NO WEEK THAT HAS NOT STARTED", () => {
    /* Both directions over the real tree: no week-keyed point belongs to a week
     * the plan merely describes, and such weeks are genuinely present to be
     * excluded -- the plan reaches two Mondays ahead. */
    if (!PUBLISHED) return;
    const D = PUBLISHED;
    const unstarted = Object.keys(D.weeks).filter((k) => {
      const facts = D.weeks[k].adherence?.facts as { elapsed_days?: number } | null;
      return (
        !(D.weeks[k].adherence?.results ?? []).length && facts?.elapsed_days !== 7
      );
    });
    expect(unstarted.length).toBeGreaterThan(0); // not a vacuous check

    for (const key of ["volume", "adherence", "quality"]) {
      const p = trendPanels(PUBLISHED).find((x) => x.key === key);
      if (!p) continue;
      expect(p.points.filter((pt) => unstarted.includes(pt.date))).toEqual([]);
    }
  });

  it("PLOTS A LIVED WEEK WITH NO RUNNING IN IT, at its measured zero", () => {
    /* Seven such weeks are on the tree -- the 2025 walk week, two of the autumn
     * injury and four of the March-April layoff. Dropped, the volume line ran
     * straight across a month nobody ran a step; their `0.0` is the
     * measurement, and `elapsed_days` of 7 is what says so. */
    if (!PUBLISHED) return;
    const D = PUBLISHED;
    const lived = Object.keys(D.weeks).filter((k) => {
      const facts = D.weeks[k].adherence?.facts as { elapsed_days?: number } | null;
      return !(D.weeks[k].adherence?.results ?? []).length && facts?.elapsed_days === 7;
    });
    expect(lived.length).toBeGreaterThan(4);

    const volume = trendPanels(PUBLISHED).find((x) => x.key === "volume")!;
    for (const k of lived) {
      const point = volume.points.find((pt) => pt.date === k);
      expect(point).toBeDefined();
      expect(point!.value).toBe(0);
    }
  });

  it("leaves that week's SCORE and QUALITY SHARE empty, because 0/0 is not 0", () => {
    if (!PUBLISHED) return;
    const D = PUBLISHED;
    const lived = Object.keys(D.weeks).filter((k) => {
      const facts = D.weeks[k].adherence?.facts as { elapsed_days?: number } | null;
      return !(D.weeks[k].adherence?.results ?? []).length && facts?.elapsed_days === 7;
    });
    for (const key of ["adherence", "quality"]) {
      const p = trendPanels(PUBLISHED).find((x) => x.key === key)!;
      for (const k of lived) {
        expect(p.points.find((pt) => pt.date === k)!.value).toBeNull();
      }
    }
  });

  it("declares a cadence on every panel, and the right one", () => {
    /* `densify` walks it to build the x axis; a weekly series stepped daily
     * gets six empty slots between every pair of points. Asserted both ways
     * over the real tree, so the list cannot go stale in either direction. */
    if (!PUBLISHED) return;
    /* The pace panels are weekly too, and land on the SUNDAY rather than the
       Monday every other weekly series uses -- a chart is confirmed as its week
       closes, so that is the date the measurement was made. Same 7-day step,
       which is all `densify` asks. */
    const weekly = new Set([
      "volume",
      "adherence",
      "quality",
      "load",
      "acwr",
      "race-times",
      "target-paces",
    ]);
    const seen = new Set<string>();
    for (const p of trendPanels(PUBLISHED)) {
      seen.add(p.key);
      expect(p.cadence).toBe(weekly.has(p.key) ? "week" : "day");
      /* And the DATA agrees with the declaration: the closest two points in
         the series sit exactly one cadence apart. The minimum rather than the
         first pair, because a series may open on a gap. */
      const idx = p.points.map((pt) => dayIndex(pt.date)!).sort((a, b) => a - b);
      const closest = idx
        .slice(1)
        .reduce((best, v, i) => Math.min(best, v - idx[i]), Infinity);
      if (idx.length > 1) expect(closest).toBe(p.cadence === "week" ? 7 : 1);
    }
    for (const key of weekly) expect(seen.has(key)).toBe(true);
  });

  it("plots no zero-day week on the total-load series", () => {
    if (!PUBLISHED) return;
    const D = PUBLISHED;
    const empty = Object.keys(D.weeks).filter(
      (k) => (D.weeks[k].load?.days ?? []).length === 0,
    );
    expect(empty.length).toBeGreaterThan(0);
    const load = trendPanels(PUBLISHED).find((x) => x.key === "load");
    expect(load!.points.filter((pt) => empty.includes(pt.date))).toEqual([]);
  });

  it("dates every point of every panel", () => {
    if (!PUBLISHED) return;
    const undated = trendPanels(PUBLISHED).flatMap((p) =>
      p.points
        .filter((pt) => !/^\d{4}-\d{2}-\d{2}$/.test(pt.date ?? ""))
        .map(() => p.key),
    );
    expect(undated).toEqual([]);
  });

  it("keeps the date and the label describing the same day", () => {
    if (!PUBLISHED) return;
    const wrong = trendPanels(PUBLISHED).flatMap((p) =>
      p.points
        .filter((pt) => pt.label !== shortDate(pt.date))
        .map((pt) => `${p.key} ${pt.date} ${pt.label}`),
    );
    expect(wrong).toEqual([]);
  });

  it("plots the weeks that WERE run, measured", () => {
    if (!PUBLISHED) return;
    const volume = trendPanels(PUBLISHED).find((x) => x.key === "volume")!;
    for (const pt of volume.points) {
      const facts = PUBLISHED.weeks[pt.date].adherence?.facts as { miles?: number };
      expect(pt.value).toBe(facts.miles);
    }
    expect(volume.points.length).toBeGreaterThan(2);
  });
});

describe("drawn", () => {
  const pt = (over: Partial<TrendPoint>): TrendPoint =>
    ({ date: "2026-08-23", label: "8/23", value: null, ...over }) as TrendPoint;

  it("is true for an ordinary measured point", () => {
    expect(drawn(pt({ value: 42 }))).toBe(true);
  });

  it("is false for a date nobody measured", () => {
    expect(drawn(pt({ value: null }))).toBe(false);
  });

  it("counts 0 as a measurement, because it is one", () => {
    // The rule the whole repo holds: `0` and `null` are different answers.
    expect(drawn(pt({ value: 0 }))).toBe(true);
  });

  it("is true when ANY series of a multi-series point carried a value", () => {
    expect(drawn(pt({ values: { a: null, b: 130 } }))).toBe(true);
  });

  it("is true for a BAND, which is an object rather than a number", () => {
    expect(drawn(pt({ values: { a: { lo: 491, hi: 530 } } }))).toBe(true);
  });

  it("is false when every series of a multi-series point is empty", () => {
    expect(drawn(pt({ values: { a: null, b: null } }))).toBe(false);
    expect(drawn(pt({ values: {} }))).toBe(false);
  });

  it("IGNORES the scalar `value` once `values` is present", () => {
    /* A multi-series point has no single scalar to be, and `paceSeries` leaves
       `value` null on every one. Falling through to it would drop every point
       both pace panels draw. */
    expect(drawn(pt({ value: null, values: { a: 130 } }))).toBe(true);
  });

  it("DOES NOT READ THE ENABLED SET -- it cannot, and that is the point", () => {
    /* If presence depended on which boxes were ticked, unticking a series would
       move the shared date window. `values` always carries every series. */
    const p = pt({ values: { a: 130, b: null } });
    expect(drawn(p)).toBe(true);
    expect(Object.keys(p.values!)).toEqual(["a", "b"]);
  });
});

describe("the pace panels join the graph list", () => {
  it("appends both, after everything measured", () => {
    if (!PUBLISHED) return;
    const keys = trendPanels(PUBLISHED).map((p) => p.key);
    expect(keys).toContain("race-times");
    expect(keys).toContain("target-paces");
    // Last, because they answer what the athlete is CAPABLE of rather than what
    // they did -- and because the picker's order is the reading order.
    expect(keys.slice(-2)).toEqual(["race-times", "target-paces"]);
  });

  it("gives series only to the multi-series panels", () => {
    if (!PUBLISHED) return;
    const multi = new Set(["race-times", "target-paces", "fitness"]);
    for (const p of trendPanels(PUBLISHED)) {
      expect(Boolean(p.series), p.key).toBe(multi.has(p.key));
    }
  });
});
