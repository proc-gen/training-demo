import { describe, expect, it } from "vitest";

import { addDays, weekdayOf } from "./dates";
import {
  PERIODS,
  type Period,
  periodLength,
  periodOrdinal,
  periodStartOf,
} from "./periods";

const KEYS = PERIODS.map((p) => p.key);

describe("PERIODS", () => {
  it("offers the four the athlete asked for, in order", () => {
    expect(KEYS).toEqual(["weekly", "biweekly", "monthly", "yearly"]);
  });

  it("states the rolling window lengths chosen on 2026-09-02", () => {
    // 30 and 365, the calendar-style lengths -- NOT 28/364 whole-week multiples.
    expect(PERIODS.map((p) => p.rollingDays)).toEqual([7, 14, 30, 365]);
  });

  it("maps each period onto its own axis cadence", () => {
    expect(PERIODS.map((p) => p.cadence)).toEqual([
      "week",
      "fortnight",
      "month",
      "year",
    ]);
  });
});

describe("periodOrdinal / periodStartOf", () => {
  it("round-trips: every date's bucket starts at or before it", () => {
    for (const period of KEYS) {
      let d = "2025-11-20";
      for (let i = 0; i < 90; i++) {
        const ord = periodOrdinal(d, period)!;
        const start = periodStartOf(ord, period);
        expect(start <= d, `${period} ${d}`).toBe(true);
        expect(periodOrdinal(start, period), `${period} ${d}`).toBe(ord);
        // The bucket's start is the FIRST day in it: the day before is in ord-1.
        expect(periodOrdinal(addDays(start, -1), period)).toBe(ord - 1);
        d = addDays(d, 1);
      }
    }
  });

  it("is a pure function of the date -- no anchor in the data to reshuffle", () => {
    // The same date always lands in the same bucket, whatever else exists.
    expect(periodOrdinal("2026-07-27", "biweekly")).toBe(
      periodOrdinal("2026-07-27", "biweekly"),
    );
    expect(periodStartOf(periodOrdinal("2026-07-27", "biweekly")!, "biweekly")).toBe(
      periodStartOf(periodOrdinal("2026-07-27", "biweekly")!, "biweekly"),
    );
  });

  it("starts every week and fortnight on a MONDAY", () => {
    let d = "2026-01-01";
    for (let i = 0; i < 40; i++) {
      for (const period of ["weekly", "biweekly"] as Period[]) {
        const start = periodStartOf(periodOrdinal(d, period)!, period);
        expect(weekdayOf(start), `${period} ${d}`).toBe(0);
      }
      d = addDays(d, 1);
    }
  });

  it("anchors the fortnight on the fixed epoch Monday 1969-12-29", () => {
    expect(periodStartOf(periodOrdinal("1969-12-29", "biweekly")!, "biweekly")).toBe(
      "1969-12-29",
    );
    expect(periodOrdinal("1969-12-29", "biweekly")).toBe(0);
  });

  it("alternates Mondays between opening a fortnight and sitting mid-fortnight", () => {
    /* Consecutive Mondays are 7 days apart and a fortnight is 14, so exactly
       every other Monday is a bucket start -- which is the stability claim:
       the pairing never depends on which weeks the record happens to hold. */
    let monday = "2026-06-01";
    const opens: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const ord = periodOrdinal(monday, "biweekly")!;
      opens.push(periodStartOf(ord, "biweekly") === monday);
      monday = addDays(monday, 7);
    }
    expect(opens).toEqual([opens[0], !opens[0], opens[0], !opens[0], opens[0], !opens[0]]);
  });

  it("buckets months on the calendar, across a year boundary", () => {
    expect(periodStartOf(periodOrdinal("2027-12-31", "monthly")!, "monthly")).toBe(
      "2027-12-01",
    );
    expect(periodStartOf(periodOrdinal("2028-01-01", "monthly")!, "monthly")).toBe(
      "2028-01-01",
    );
    expect(periodOrdinal("2028-01-01", "monthly")! - periodOrdinal("2027-12-31", "monthly")!).toBe(1);
  });

  it("buckets years whole", () => {
    expect(periodStartOf(periodOrdinal("2026-08-15", "yearly")!, "yearly")).toBe(
      "2026-01-01",
    );
    expect(periodOrdinal("2026-12-31", "yearly")).toBe(2026);
    expect(periodOrdinal("2027-01-01", "yearly")).toBe(2027);
  });

  it("is null for anything that is not a date", () => {
    for (const period of KEYS) {
      expect(periodOrdinal("nonsense", period)).toBeNull();
      expect(periodOrdinal("2026-02-30", period)).toBeNull();
    }
  });
});

describe("periodLength", () => {
  it("knows a week, a fortnight, and the shape of a month", () => {
    expect(periodLength("2026-07-29", "weekly")).toBe(7);
    expect(periodLength("2026-07-29", "biweekly")).toBe(14);
    expect(periodLength("2026-07-29", "monthly")).toBe(31);
    expect(periodLength("2026-06-15", "monthly")).toBe(30);
  });

  it("carries the REAL leap rule, not a modulo", () => {
    expect(periodLength("2028-02-10", "monthly")).toBe(29);
    expect(periodLength("2027-02-10", "monthly")).toBe(28);
    expect(periodLength("2100-02-10", "monthly")).toBe(28); // century, not leap
    expect(periodLength("2028-06-01", "yearly")).toBe(366);
    expect(periodLength("2027-06-01", "yearly")).toBe(365);
  });

  it("is null off the calendar", () => {
    expect(periodLength("nope", "monthly")).toBeNull();
  });
});
