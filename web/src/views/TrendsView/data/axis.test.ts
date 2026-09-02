import { describe, expect, it } from "vitest";

import { axisPoints, crossesYears, densify, slotAt } from "./axis";
import { addDays } from "./dates";
import type { TrendPoint } from "./panels";

const pt = (date: string, value: number | null = 1): TrendPoint => ({
  date,
  label: date.slice(5).replace("-0", "/").replace("-", "/"),
  value,
});

const dates = (points: TrendPoint[]) => points.map((p) => p.date);
const values = (points: TrendPoint[]) => points.map((p) => p.value);

describe("densify", () => {
  it("fills a weekly hole with null slots", () => {
    /* The 2026 layoff: five weeks between 03-09 and 04-13 with no runs in them.
     * Drawn without slots, the line ran straight across a month. */
    const got = densify([pt("2026-03-09", 41), pt("2026-04-13", 12)], "week");
    expect(dates(got)).toEqual([
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
      "2026-04-13",
    ]);
    expect(values(got)).toEqual([41, null, null, null, null, 12]);
  });

  it("fills a single missing day", () => {
    // Sleep and HRV each drop eight or nine days like this.
    const got = densify([pt("2026-06-10", 7.2), pt("2026-06-12", 6.8)], "day");
    expect(dates(got)).toEqual(["2026-06-10", "2026-06-11", "2026-06-12"]);
    expect(values(got)).toEqual([7.2, null, 6.8]);
  });

  it("leaves a series with no holes exactly as it was", () => {
    const points = [pt("2026-08-10"), pt("2026-08-11"), pt("2026-08-12")];
    expect(densify(points, "day")).toEqual(points);
  });

  it("keeps the whole point, not just its value", () => {
    const rich: TrendPoint = {
      date: "2026-08-12",
      label: "8/12",
      value: null,
      values: { trimp: 30.6 },
    };
    const got = densify([pt("2026-08-10", 12), rich], "day");
    expect(got[2]).toBe(rich);
    // An invented slot carries no values, so a multi-series chart draws nothing
    // on it -- the line breaks there.
    expect(got[1].values).toBeUndefined();
  });

  it("is INTERIOR ONLY -- it never reaches out to a window's edges", () => {
    const got = densify([pt("2026-08-10"), pt("2026-08-12")], "day");
    expect(got[0].date).toBe("2026-08-10");
    expect(got[got.length - 1].date).toBe("2026-08-12");
  });

  it("NEVER DROPS A POINT to fit the grid", () => {
    /* An off-Monday point in a weekly series means the cadence and the data
     * disagree. An uneven axis is a display defect; a missing measurement is a
     * lie, so the input comes back untouched. */
    const odd = [pt("2026-03-09"), pt("2026-03-12"), pt("2026-03-23")];
    expect(densify(odd, "week")).toEqual(odd);
  });

  it("returns a span that does not divide by the cadence untouched", () => {
    const points = [pt("2026-03-09"), pt("2026-03-19")];
    expect(densify(points, "week")).toEqual(points);
  });

  it("sorts before it walks, so an unordered series still densifies", () => {
    const got = densify([pt("2026-08-12", 3), pt("2026-08-10", 1)], "day");
    expect(dates(got)).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("passes a series too short to have a hole straight through", () => {
    expect(densify([], "day")).toEqual([]);
    const one = [pt("2026-08-10")];
    expect(densify(one, "day")).toEqual(one);
  });

  it("refuses a span that would explode into slots", () => {
    // A guard, not a feature: 4,000 daily slots is a decade, and a runaway
    // array here would hang the render rather than fail.
    const wide = [pt("1900-01-01"), pt("2026-01-01")];
    expect(densify(wide, "day")).toEqual(wide);
  });

  it("carries a label on every slot it invents", () => {
    const got = densify([pt("2026-06-10"), pt("2026-06-12")], "day");
    expect(got[1].label).toBe("6/11");
  });

  it("steps a fortnight cadence by 14 days", () => {
    // 2026-07-27 and 2026-08-24 are fortnight starts two buckets apart.
    const got = densify([pt("2026-07-27", 60), pt("2026-08-24", 70)], "fortnight");
    expect(dates(got)).toEqual(["2026-07-27", "2026-08-10", "2026-08-24"]);
    expect(values(got)).toEqual([60, null, 70]);
  });

  it("walks MONTH slots on the calendar, not on a day step", () => {
    /* A month is 28-31 days, so no constant step can walk one -- the slots
       come from `periods.ts`' own buckets, one per calendar month. */
    const got = densify([pt("2026-05-01", 120), pt("2026-08-01", 150)], "month");
    expect(dates(got)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"]);
    expect(values(got)).toEqual([120, null, null, 150]);
  });

  it("walks month slots across a year boundary", () => {
    const got = densify([pt("2027-12-01", 1), pt("2028-02-01", 2)], "month");
    expect(dates(got)).toEqual(["2027-12-01", "2028-01-01", "2028-02-01"]);
  });

  it("walks YEAR slots the same way", () => {
    const got = densify([pt("2025-01-01", 900), pt("2027-01-01", 1100)], "year");
    expect(dates(got)).toEqual(["2025-01-01", "2026-01-01", "2027-01-01"]);
    expect(values(got)).toEqual([900, null, 1100]);
  });

  it("REFUSES a calendar point off its period's canonical start", () => {
    /* `boundarySeries` plots buckets at their starts; anything else means the
       cadence and the data disagree, and the input comes back untouched --
       the same refusal the fixed-step walk makes. */
    const odd = [pt("2026-05-01"), pt("2026-06-15")];
    expect(densify(odd, "month")).toEqual(odd);
    const oddYear = [pt("2025-01-01"), pt("2026-07-01")];
    expect(densify(oddYear, "year")).toEqual(oddYear);
  });
});

describe("crossesYears", () => {
  it("is true across a boundary and false inside one year", () => {
    expect(crossesYears(["2025-12-31", "2026-01-01"])).toBe(true);
    expect(crossesYears(["2026-01-01", "2026-12-31"])).toBe(false);
    expect(crossesYears([])).toBe(false);
  });

  it("ignores anything that is not a date", () => {
    expect(crossesYears(["2026-01-01", "nonsense"])).toBe(false);
  });
});

describe("axisPoints", () => {
  const weekly = (count: number, from = "2026-01-05"): TrendPoint[] => {
    const out: TrendPoint[] = [];
    let d = from;
    for (let i = 0; i < count; i += 1) {
      out.push(pt(d, 10 + i));
      d = addDays(d, 7);
    }
    return out;
  };

  it("densifies, labels and ticks in one call", () => {
    const got = axisPoints({
      points: [pt("2026-03-09", 41), pt("2026-04-13", 12)],
      cadence: "week",
      innerWidth: 854,
    });
    expect(got).toHaveLength(6);
    expect(got.some((p) => p.tick)).toBe(true);
  });

  it("adds the year to EVERY label once the span crosses one", () => {
    const got = axisPoints({
      points: [pt("2025-12-29", 1), pt("2026-01-05", 2)],
      cadence: "week",
      innerWidth: 854,
    });
    expect(got.map((p) => p.label)).toEqual(["12/29/25", "1/5/26"]);
  });

  it("leaves the year off a span inside one year", () => {
    const got = axisPoints({
      points: [pt("2026-08-10", 1), pt("2026-08-17", 2)],
      cadence: "week",
      innerWidth: 854,
    });
    expect(got.map((p) => p.label)).toEqual(["8/10", "8/17"]);
  });

  it("thins the ticks as the plot narrows", () => {
    const points = weekly(52, "2026-01-05");
    const wide = axisPoints({ points, cadence: "week", innerWidth: 854 });
    const narrow = axisPoints({ points, cadence: "week", innerWidth: 200 });
    const count = (ps: TrendPoint[]) => ps.filter((p) => p.tick).length;
    expect(count(wide)).toBeGreaterThan(count(narrow));
    expect(count(narrow)).toBeGreaterThanOrEqual(2);
  });

  it("ticks the last slot, whatever the width", () => {
    const points = weekly(52, "2026-01-05");
    for (const innerWidth of [854, 400, 120, 10]) {
      const got = axisPoints({ points, cadence: "week", innerWidth });
      expect(got[got.length - 1].tick).toBe(true);
    }
  });

  it("does not mutate the points it was given", () => {
    const points = [pt("2026-08-10", 1), pt("2026-08-17", 2)];
    axisPoints({ points, cadence: "week", innerWidth: 854 });
    expect(points.every((p) => p.tick === undefined)).toBe(true);
  });

  it("is empty for no points", () => {
    expect(axisPoints({ points: [], cadence: "day", innerWidth: 854 })).toEqual([]);
  });
});

describe("slotAt", () => {
  /* The pace panel's own grid: charts confirmed on Sundays, seven days apart. */
  const weekly = ["2026-07-26", "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23"].map(
    (d) => ({ date: d }),
  );

  it("PLACES A TUESDAY BETWEEN TWO SUNDAY CHARTS -- the whole point", () => {
    /* 2026-08-18 is two days past the 08-16 chart, which is slot 3, so it sits
       two sevenths of the way to slot 4. A weekly axis has no slot for it and
       never will: quality lands on Tuesday, Friday and Thursday here. */
    expect(slotAt("2026-08-18", weekly, "week")).toBeCloseTo(3 + 2 / 7, 10);
  });

  it("lands exactly on a slot for a date that IS one", () => {
    expect(slotAt("2026-07-26", weekly, "week")).toBe(0);
    expect(slotAt("2026-08-09", weekly, "week")).toBe(2);
    expect(slotAt("2026-08-23", weekly, "week")).toBe(4);
  });

  it("is null outside the grid, at either end", () => {
    /* A workout in a week the window clipped: there is no pair of slots to put
       it between, and extrapolating past the last would draw it off the plot. */
    expect(slotAt("2026-07-25", weekly, "week")).toBeNull();
    expect(slotAt("2026-08-24", weekly, "week")).toBeNull();
  });

  it("REFUSES ON AN UNEVEN GRID rather than placing every mark wrong", () => {
    /* `densify` hands its input back untouched when a date misses the cadence,
       and a linear date -> index map over uneven slots looks entirely plausible
       while being wrong about every mark on the plot. */
    const uneven = [{ date: "2026-07-26" }, { date: "2026-08-02" }, { date: "2026-08-11" }];
    expect(slotAt("2026-08-02", uneven, "week")).toBeNull();
  });

  it("steps by one on a daily cadence", () => {
    const daily = ["2026-08-10", "2026-08-11", "2026-08-12"].map((d) => ({ date: d }));
    expect(slotAt("2026-08-11", daily, "day")).toBe(1);
    expect(slotAt("2026-08-13", daily, "day")).toBeNull();
  });

  it("is null for fewer than two slots, and for a date that is not one", () => {
    expect(slotAt("2026-08-18", [{ date: "2026-08-16" }], "week")).toBeNull();
    expect(slotAt("2026-08-18", [], "week")).toBeNull();
    expect(slotAt("not-a-date", weekly, "week")).toBeNull();
  });

  it("steps by 14 on a fortnight cadence", () => {
    const fortnights = ["2026-07-27", "2026-08-10", "2026-08-24"].map((d) => ({ date: d }));
    expect(slotAt("2026-08-10", fortnights, "fortnight")).toBe(1);
    expect(slotAt("2026-08-03", fortnights, "fortnight")).toBeCloseTo(0.5, 10);
  });

  it("REFUSES the calendar cadences -- their slots are not evenly spaced", () => {
    /* A linear date->index map over month slots 28-31 days apart would place
       every mark wrong while looking plausible. No producer places marks on a
       month or year axis; the refusal is the existing no-pair-of-slots answer. */
    const months = ["2026-05-01", "2026-06-01", "2026-07-01"].map((d) => ({ date: d }));
    expect(slotAt("2026-06-01", months, "month")).toBeNull();
    const years = ["2025-01-01", "2026-01-01"].map((d) => ({ date: d }));
    expect(slotAt("2025-06-01", years, "year")).toBeNull();
  });
});
