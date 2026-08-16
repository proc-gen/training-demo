import { describe, expect, it } from "vitest";

import { shortDate } from "@/lib/data/format";
import type { Payload, Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { stackTotal, trendPanels } from "./panels";

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

describe("the fitness curve", () => {
  /* Fitness, fatigue and form got their first chart on 2026-08-11. Until then
   * they were five hand-read weekly points off Runalyze's form curve; they are
   * a daily series computed from heart rate now. */
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

  it("adds fitness, form and fatigue when a curve is published", () => {
    const got = keys(withDays([day("2026-07-27")]));
    expect(got).toContain("ctl");
    expect(got).toContain("tsb");
    expect(got).toContain("atl");
  });

  it("omits all three when no week carries a curve", () => {
    const got = keys(
      payload({ weeks: { w: week({ load: L({ days: [{ date: "2026-07-27" }] }) }) } }),
    );
    expect(got).not.toContain("ctl");
    expect(got).not.toContain("atl");
  });

  it("gives form a zero reference, since it is a difference", () => {
    expect(panel(withDays([day("2026-07-27")]), "tsb").reference).toBe(0);
  });

  it("gives fitness no reference line, because there is no danger level", () => {
    expect(panel(withDays([day("2026-07-27")]), "ctl").reference ?? null).toBeNull();
  });

  it("colours all three as LOAD, following the domain", () => {
    const p = trendPanels(withDays([day("2026-07-27")]));
    for (const k of ["ctl", "atl", "tsb"]) {
      expect(p.find((x) => x.key === k)!.color).toBe("var(--series-2)");
    }
  });

  it("DROPS a day whose fitness was withheld, and says nothing about it", () => {
    /* The 42-day average had not yet forgotten its zero seed. The panel stated
     * the count until 2026-08-15; the drop is unchanged, the sentence is gone. */
    const p = withDays([day("2026-07-27", { ctl: null, tsb: null }), day("2026-07-28")]);
    expect(panel(p, "ctl").points.map((pt) => pt.date)).toEqual(["2026-07-28"]);
  });

  it("still plots fatigue when every fitness figure was withheld", () => {
    const got = keys(withDays([day("2026-07-27", { ctl: null, tsb: null })]));
    expect(got).toContain("atl");
    expect(got).not.toContain("ctl");
  });
});

describe("the daily TRIMP panel", () => {
  const day = (date: string, trimp: unknown, bg: unknown) => ({
    date,
    trimp,
    bg_trimp: bg,
    ctl: 80,
    atl: 95,
    tsb: -15,
  });
  const withDays = (days: Record<string, unknown>[]) =>
    payload({ weeks: { "2026-08-10": week({ load: L({ days }) }) } });

  const P = withDays([day("2026-08-10", 30.59, 4.19), day("2026-08-11", 129.65, 11.28)]);

  it("is BARS, not a line -- a per-day impulse is a quantity per bucket", () => {
    expect(panel(P, "trimp").kind).toBe("columns");
  });

  it("carries the run and background components as parts", () => {
    expect(panel(P, "trimp").points[0].parts).toEqual([
      { value: 30.59, color: "var(--series-1)", label: "run" },
      { value: 4.19, color: "var(--series-2)", label: "background" },
    ]);
  });

  it("takes the CALENDAR's colours for the split, not this view's domain rule", () => {
    /* Blue run, orange background -- already encoded twice for the identical
     * distinction, in `CalendarCell` and `LoadPanel`. One meaning per colour
     * across the page beats one rule per view. */
    const parts = panel(P, "trimp").points[0].parts!;
    expect(parts.map((x) => x.color)).toEqual(["var(--series-1)", "var(--series-2)"]);
  });

  it("counts and anchors on the RUN trimp, which is the measured instrument", () => {
    expect(panel(P, "trimp").points.map((pt) => pt.value)).toEqual([30.59, 129.65]);
  });

  it("keeps a day whose background was never measured", () => {
    // 2026-08-15 is exactly this: 32.99 of running impulse, no background row.
    const p = withDays([day("2026-08-15", 32.99, null)]);
    expect(panel(p, "trimp").points[0].value).toBe(32.99);
    expect(panel(p, "trimp").points[0].parts![1].value).toBeNull();
  });

  it("keeps a REST day, whose zero is a measurement", () => {
    const p = withDays([day("2026-08-10", 0, 3.2)]);
    expect(panel(p, "trimp").points.map((pt) => pt.value)).toEqual([0]);
  });

  it("is omitted when no day priced an impulse", () => {
    const p = withDays([day("2026-08-10", null, null)]);
    expect(keys(p)).not.toContain("trimp");
  });
});

describe("stackTotal", () => {
  const pt = (...values: (number | null)[]) => ({
    date: "2026-08-10",
    label: "8/10",
    value: values[0],
    parts: values.map((value) => ({ value, color: "x", label: "y" })),
  });

  it("sums the components", () => {
    expect(stackTotal(pt(30.5, 4.5))).toBe(35);
  });

  it("sums a zero, which is a measurement", () => {
    expect(stackTotal(pt(0, 4.5))).toBe(4.5);
  });

  it("WITHHOLDS when a component was never measured", () => {
    /* Summing what is present would publish a smaller number wearing the same
     * name. */
    expect(stackTotal(pt(32.99, null))).toBeNull();
  });

  it("withholds for a point with no parts at all", () => {
    expect(stackTotal({ date: "d", label: "d", value: 1 })).toBeNull();
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

  it("PLOTS NO WEEK THAT HAS NOT BEEN RUN", () => {
    /* Both directions over the real tree: every week-keyed point belongs to a
     * week with measured runs, and the weeks the plan describes but nobody has
     * run are genuinely present to be excluded. */
    if (!PUBLISHED) return;
    const D = PUBLISHED;
    const unrun = Object.keys(D.weeks).filter(
      (k) => !(D.weeks[k].adherence?.results ?? []).length,
    );
    expect(unrun.length).toBeGreaterThan(0); // not a vacuous check

    for (const key of ["volume", "adherence", "quality"]) {
      const p = trendPanels(PUBLISHED).find((x) => x.key === key);
      if (!p) continue;
      expect(p.points.filter((pt) => unrun.includes(pt.date))).toEqual([]);
    }
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
