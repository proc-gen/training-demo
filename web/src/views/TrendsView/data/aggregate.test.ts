import { describe, expect, it } from "vitest";

import type { Payload, Week } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import {
  DEFAULT_AGG,
  aggregatedPanel,
  boundarySeries,
  isDefaultAgg,
  rollingSeries,
} from "./aggregate";
import { addDays } from "./dates";
import { trendPanels } from "./panels";

const D = PUBLISHED;

/** A fully covered ledger of single-component days, `value` per day. */
const covered = (from: string, count: number, value = 1): Map<string, number[]> => {
  const out = new Map<string, number[]>();
  for (let i = 0; i < count; i++) out.set(addDays(from, i), [value]);
  return out;
};

const first = (sums: number[]) => sums[0];
const dates = (points: { date: string }[]) => points.map((p) => p.date);
const values = (points: { value: number | null }[]) => points.map((p) => p.value);

describe("boundarySeries", () => {
  it("buckets whole weeks at their Mondays", () => {
    // 2026-07-27 is a Monday; 14 covered days are exactly two Mon-Sun weeks.
    const got = boundarySeries(covered("2026-07-27", 14), "weekly", first, false);
    expect(dates(got)).toEqual(["2026-07-27", "2026-08-03"]);
    expect(values(got)).toEqual([7, 7]);
  });

  it("sums a fortnight as one bucket, at its own start", () => {
    const got = boundarySeries(covered("2026-07-27", 14), "biweekly", first, false);
    expect(got).toHaveLength(1);
    expect(got[0].value).toBe(14);
    // The bucket start is the fixed-epoch fortnight's, a Monday by construction.
    expect(["2026-07-20", "2026-07-27"]).toContain(got[0].date);
  });

  it("requires a month covered WHOLE, and one missing day omits it", () => {
    const whole = covered("2026-06-01", 30);
    expect(values(boundarySeries(whole, "monthly", first, false))).toEqual([30]);

    const holed = covered("2026-06-01", 30);
    holed.delete("2026-06-15");
    expect(boundarySeries(holed, "monthly", first, false)).toEqual([]);
  });

  it("knows February's length, leap year included", () => {
    // 2028 is a leap year: 28 covered days are not a whole February.
    expect(boundarySeries(covered("2028-02-01", 28), "monthly", first, false)).toEqual([]);
    expect(values(boundarySeries(covered("2028-02-01", 29), "monthly", first, false))).toEqual([29]);
    // 2027 is not: 28 days are the whole month.
    expect(values(boundarySeries(covered("2027-02-01", 28), "monthly", first, false))).toEqual([28]);
  });

  it("omits a LEADING partial period -- a span the record cannot answer", () => {
    // Coverage starts mid-June; June is omitted, July plots whole.
    const got = boundarySeries(covered("2026-06-15", 16 + 31), "monthly", first, false);
    expect(dates(got)).toEqual(["2026-07-01"]);
    expect(values(got)).toEqual([31]);
  });

  it("plots the TRAILING in-progress period to date only where allowed", () => {
    // Coverage runs June whole plus ten days of July.
    const days = covered("2026-06-01", 30 + 10);
    const withPartial = boundarySeries(days, "monthly", first, true);
    expect(dates(withPartial)).toEqual(["2026-06-01", "2026-07-01"]);
    expect(values(withPartial)).toEqual([30, 10]);
    // Total load's rule: whole periods only.
    const wholeOnly = boundarySeries(days, "monthly", first, false);
    expect(dates(wholeOnly)).toEqual(["2026-06-01"]);
  });

  it("does not let the trailing allowance excuse a LEADING gap", () => {
    // Ten covered days mid-month: leading-partial and trailing-partial at once,
    // and the leading rule wins -- nothing plots.
    expect(boundarySeries(covered("2026-06-10", 10), "monthly", first, true)).toEqual([]);
  });

  it("buckets years whole, at January 1st", () => {
    const got = boundarySeries(covered("2027-01-01", 365 + 20), "yearly", first, true);
    expect(dates(got)).toEqual(["2027-01-01", "2028-01-01"]);
    expect(values(got)).toEqual([365, 20]);
  });

  it("emits a covered bucket whose value is NULL as an undrawn slot", () => {
    // The quality rule at bucket scale: a covered span with no seconds has no
    // share, and the slot stays -- absent would read as an uncovered bucket.
    const got = boundarySeries(covered("2026-07-27", 7), "weekly", () => null, false);
    expect(got).toHaveLength(1);
    expect(got[0].value).toBeNull();
  });

  it("is empty on an empty ledger", () => {
    expect(boundarySeries(new Map(), "weekly", first, true)).toEqual([]);
  });
});

describe("rollingSeries", () => {
  it("emits one point per day once the window fits, ending on the newest day", () => {
    const got = rollingSeries(covered("2026-07-01", 10), 7, first);
    // The first six days cannot hold a 7-day window; days 7..10 can.
    expect(dates(got)).toEqual(["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"]);
    expect(values(got)).toEqual([7, 7, 7, 7]);
  });

  it("sums the WINDOW, not the record", () => {
    const days = covered("2026-07-01", 10);
    days.set("2026-07-03", [100]);
    const got = rollingSeries(days, 7, first);
    // 07-03 is inside the first three windows and outside the last.
    expect(values(got)).toEqual([106, 106, 106, 7]);
  });

  it("omits EXACTLY the windows an uncovered day touches", () => {
    const days = covered("2026-07-01", 20);
    days.delete("2026-07-08");
    const got = rollingSeries(days, 7, first);
    // Windows ending 07-08 .. 07-14 all contain the hole; 07-07 and 07-15 do not.
    expect(dates(got)).toEqual([
      "2026-07-07",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
      "2026-07-19",
      "2026-07-20",
    ]);
  });

  it("is empty on a record shorter than the window", () => {
    expect(rollingSeries(covered("2026-07-01", 6), 7, first)).toEqual([]);
    expect(rollingSeries(new Map(), 7, first)).toEqual([]);
  });

  it("carries every component through to `value`", () => {
    const days = new Map<string, number[]>();
    for (let i = 0; i < 7; i++) days.set(addDays("2026-07-01", i), [10, 100]);
    const got = rollingSeries(days, 7, (s) => (s[1] ? (s[0] / s[1]) * 100 : null));
    expect(values(got)).toEqual([10]);
  });
});

describe("a ratio aggregates its SUMS, never its shares", () => {
  it("weighs a small week by its seconds, not one vote", () => {
    /* Week one: 100 quality of 1000 s -> 10%. Week two: 50 of 100 -> 50%.
       The fortnight is 150/1100 = 13.6%, and a mean of shares would say 30. */
    const days = new Map<string, number[]>([
      ["2026-07-27", [100, 1000]],
      ["2026-08-03", [50, 100]],
    ]);
    // Fill the remaining days of both weeks with zero-quality zero-seconds.
    for (let i = 0; i < 14; i++) {
      const d = addDays("2026-07-27", i);
      if (!days.has(d)) days.set(d, [0, 0]);
    }
    const share = (s: number[]) => (s[1] ? (s[0] / s[1]) * 100 : null);
    const got = boundarySeries(days, "biweekly", share, false);
    expect(got).toHaveLength(1);
    expect(got[0].value).toBeCloseTo((150 / 1100) * 100, 10);
    expect(got[0].value).not.toBeCloseTo(30, 1);
  });
});

describe("aggregatedPanel", () => {
  const payload = (weeks: Record<string, unknown>): Payload =>
    ({ weeks, days: [], history: {} }) as unknown as Payload;

  const ran = (results: unknown[], elapsed: number, extra: Record<string, unknown> = {}) =>
    ({
      adherence: {
        results,
        facts: { elapsed_days: elapsed, ...extra },
        scores: { week: { pct: 90 } },
      },
    }) as unknown as Week;

  const run = (date: string, miles: number, seconds: number) => ({
    date,
    role: "easy",
    miles,
    seconds,
  });

  /* Two whole Mon-Sun weeks of running, one run each. */
  const TWO_WEEKS = payload({
    "2026-07-27": ran([run("2026-07-28", 30, 15000)], 7, { miles: 30 }),
    "2026-08-03": ran([run("2026-08-04", 40, 20000)], 7, { miles: 40 }),
  });

  it("returns the panel ITSELF for the default aggregation", () => {
    expect(isDefaultAgg(DEFAULT_AGG)).toBe(true);
    const panel = trendPanels(TWO_WEEKS).find((p) => p.key === "volume")!;
    expect(aggregatedPanel(panel, TWO_WEEKS, DEFAULT_AGG)).toBe(panel);
  });

  it("returns a NON-aggregable panel untouched under any aggregation", () => {
    const adherence = trendPanels(TWO_WEEKS).find((p) => p.key === "adherence")!;
    expect(adherence.aggregable).toBeUndefined();
    expect(
      aggregatedPanel(adherence, TWO_WEEKS, { mode: "rolling", period: "monthly" }),
    ).toBe(adherence);
  });

  it("buckets volume bi-weekly on the calendar, retitled period-free", () => {
    const panel = trendPanels(TWO_WEEKS).find((p) => p.key === "volume")!;
    const got = aggregatedPanel(panel, TWO_WEEKS, {
      mode: "boundaries",
      period: "biweekly",
    });
    expect(got.title).toBe("Volume");
    expect(got.cadence).toBe("fortnight");
    // The two weeks share a fortnight or split across two, depending on epoch
    // parity -- either way every mile lands exactly once.
    const total = got.points.reduce((sum, p) => sum + (p.value ?? 0), 0);
    expect(total).toBe(70);
    expect(got.format).toBe(panel.format);
    expect(got.zero).toBe(panel.zero);
  });

  it("rolls volume over a 7-day window at DAY cadence", () => {
    const panel = trendPanels(TWO_WEEKS).find((p) => p.key === "volume")!;
    const got = aggregatedPanel(panel, TWO_WEEKS, { mode: "rolling", period: "weekly" });
    expect(got.cadence).toBe("day");
    // 14 covered days hold windows ending on days 7..14.
    expect(got.points).toHaveLength(8);
    expect(got.points[0].date).toBe("2026-08-02");
    expect(got.points[got.points.length - 1].date).toBe("2026-08-09");
    /* The runs are 7 days apart, so NO 7-day window holds both -- the window
       ending 08-03 still reaches back to the 07-28 run, the one ending 08-04
       has dropped it and picked up that day's own. */
    expect(got.points.find((p) => p.date === "2026-08-03")!.value).toBe(30);
    expect(got.points.find((p) => p.date === "2026-08-04")!.value).toBe(40);
    expect(got.points.find((p) => p.date === "2026-08-09")!.value).toBe(40);
  });

  it("rolls a 30-day monthly window, not a calendar month", () => {
    const panel = trendPanels(TWO_WEEKS).find((p) => p.key === "volume")!;
    const got = aggregatedPanel(panel, TWO_WEEKS, { mode: "rolling", period: "monthly" });
    // 14 covered days cannot hold a 30-day window.
    expect(got.points).toEqual([]);
  });

  it("computes quality share from summed seconds", () => {
    const quality = payload({
      "2026-07-27": ran(
        [
          {
            date: "2026-07-28",
            role: "subt",
            miles: 6,
            seconds: 3000,
            detail: { core_seconds: 1500 },
          },
          run("2026-07-30", 5, 2000),
        ],
        7,
        { seconds: 5000, quality_share: 0.3 },
      ),
    });
    const panel = trendPanels(quality).find((p) => p.key === "quality")!;
    const got = aggregatedPanel(panel, quality, { mode: "rolling", period: "weekly" });
    expect(got.points).toHaveLength(1);
    expect(got.points[0].value).toBeCloseTo((1500 / 5000) * 100, 10);
    expect(got.title).toBe("Quality share of time");
  });

  it("gives a covered zero-run span volume 0 and quality NO SHARE", () => {
    const layoff = payload({
      "2026-07-27": ran([], 7, { miles: 0, seconds: 0 }),
    });
    const volume = trendPanels(layoff).find((p) => p.key === "volume");
    // `hasRuns` is false and the week is not fully lived in trendPanels' eyes
    // unless elapsed_days is 7 -- here it is, so the panel exists.
    expect(volume).toBeTruthy();
    const v = aggregatedPanel(volume!, layoff, { mode: "rolling", period: "weekly" });
    expect(v.points.map((p) => p.value)).toEqual([0]);
    const quality = trendPanels(layoff).find((p) => p.key === "quality")!;
    const q = aggregatedPanel(quality, layoff, { mode: "rolling", period: "weekly" });
    expect(q.points.map((p) => p.value)).toEqual([null]);
  });

  it("sums load over MEASURED days and refuses the trailing partial bucket", () => {
    const L = (days: unknown[]) =>
      ({
        adherence: { results: [{ id: 1 }], facts: { elapsed_days: 7 }, scores: {} },
        load: { days, flags: [], integrity: { total: 1 } },
      }) as unknown as Week;
    const days = [];
    for (let i = 0; i < 7; i++) days.push({ date: addDays("2026-07-27", i), se: 1000 });
    const p = payload({
      "2026-07-27": L(days),
      "2026-08-03": L([{ date: "2026-08-03", se: 40584, scored: false }]),
    });
    const panel = trendPanels(p).find((p) => p.key === "load")!;
    const weekly = aggregatedPanel(panel, p, { mode: "boundaries", period: "weekly" });
    // The default agg is identity -- ask for a NON-default one via biweekly,
    // and the whole-periods rule drops the half-covered trailing fortnight
    // wherever the epoch splits these weeks; summing what IS plotted still
    // lands on whole thousands with the unscored day never zeroed in.
    expect(weekly).toBe(panel); // {boundaries, weekly} IS the identity
    const rolled = aggregatedPanel(panel, p, { mode: "rolling", period: "weekly" });
    // Windows ending 08-02 (7 covered days) and 08-03 (six + the unscored
    // measured Monday) both plot; the unscored day COUNTS.
    expect(rolled.points.find((x) => x.date === "2026-08-02")!.value).toBe(7000);
    expect(rolled.points.find((x) => x.date === "2026-08-03")!.value).toBe(
      6000 + 40584,
    );
  });
});

describe("against the committed tree", () => {
  has(D)("leaves the three default series byte-identical", () => {
    for (const key of ["volume", "quality", "load"]) {
      const panel = trendPanels(D!).find((p) => p.key === key)!;
      expect(aggregatedPanel(panel, D!, DEFAULT_AGG)).toBe(panel);
    }
  });

  has(D)("flags exactly the three summable panels aggregable", () => {
    const aggregable = trendPanels(D!)
      .filter((p) => p.aggregable)
      .map((p) => p.key);
    expect(aggregable).toEqual(["volume", "quality", "load"]);
  });

  has(D)("draws a rolling 30-day volume that ends on the newest covered day", () => {
    const panel = trendPanels(D!).find((p) => p.key === "volume")!;
    const got = aggregatedPanel(panel, D!, { mode: "rolling", period: "monthly" });
    expect(got.points.length).toBeGreaterThan(30);
    // Never past the newest weekly point's own week -- the plan's zeros are
    // not covered days, so no window reaches into them.
    const newestWeekly = panel.points[panel.points.length - 1].date;
    const newestRolling = got.points[got.points.length - 1].date;
    expect(newestRolling < addDays(newestWeekly, 7)).toBe(true);
  });
});
