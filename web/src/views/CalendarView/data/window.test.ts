import { describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { mondayOf } from "./grid";
import {
  DEFAULT_WEEKS,
  WEEK_CHOICES,
  clampWeeks,
  defaultLastDay,
  isIsoDate,
  newestMeasuredDate,
  weekRowsEnding,
} from "./window";

const payload = (over: Partial<Payload>): Payload =>
  ({ days: [], weeks: {}, ...over }) as unknown as Payload;

const days = (...dates: string[]) =>
  dates.map((date) => ({ date })) as Payload["days"];

describe("isIsoDate", () => {
  it("accepts a real date", () => {
    expect(isIsoDate("2026-07-27")).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    // A date input can be handed 2026-02-31 by a keyboard; a window bounded by
    // a day that is not a day would land the grid wherever Date rolled it to.
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("2026-01-00")).toBe(false);
  });

  it("carries the real leap rule, not `y % 4`", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2100-02-29")).toBe(false);
    expect(isIsoDate("2000-02-29")).toBe(true);
  });

  it("rejects the half-typed states a date input reports", () => {
    // Treating one as a boundary would blank the grid between two keystrokes.
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate("2026-07")).toBe(false);
    expect(isIsoDate("2026-7-27")).toBe(false);
  });
});

describe("newestMeasuredDate", () => {
  it("is the newest date in the steps/wellness join", () => {
    expect(newestMeasuredDate(payload({ days: days("2026-07-01", "2026-08-15") })))
      .toBe("2026-08-15");
  });

  it("does not assume payload order", () => {
    expect(newestMeasuredDate(payload({ days: days("2026-08-15", "2026-07-01") })))
      .toBe("2026-08-15");
  });

  it("is null with nothing measured", () => {
    expect(newestMeasuredDate(payload({ days: [] }))).toBeNull();
    expect(newestMeasuredDate(payload({ days: undefined }))).toBeNull();
  });

  it("ignores a row with no date", () => {
    const p = payload({ days: [{ total_steps: "100" }] as Payload["days"] });
    expect(newestMeasuredDate(p)).toBeNull();
  });
});

describe("defaultLastDay", () => {
  it("IS A FACT ABOUT THE DATA, NEVER A BROWSER CLOCK", () => {
    /* The third place in this app to make that choice -- `range.ts` and
     * `defaultWeekKey` are the others -- and what lets every render case be
     * asserted against the committed tree rather than against the day the suite
     * happens to run. */
    const p = payload({ days: days("2026-08-15") });
    expect(defaultLastDay(p)).toBe("2026-08-15");
    expect(defaultLastDay(p)).toBe("2026-08-15");
  });

  it("prefers the newest MEASUREMENT over the newest plan", () => {
    // Opening on a week nobody has run is the defect `defaultWeekKey` fixed on
    // 2026-08-14; this is the same question one view over.
    const p = payload({
      days: days("2026-08-15"),
      weeks: { "2026-08-24": {} } as unknown as Payload["weeks"],
    });
    expect(defaultLastDay(p)).toBe("2026-08-15");
  });

  it("falls back to the newest week's END where nothing was measured", () => {
    // A fresh athlete with a plan and no exports still gets a grid, and the
    // plan is the only thing there is to show them.
    const p = payload({
      weeks: { "2026-08-17": {}, "2026-08-24": {} } as unknown as Payload["weeks"],
    });
    expect(defaultLastDay(p)).toBe("2026-08-30");
  });

  it("is null with no data and no plan at all", () => {
    expect(defaultLastDay(payload({}))).toBeNull();
  });
});

describe("weekRowsEnding", () => {
  it("ends with the week CONTAINING the chosen day, not on the day", () => {
    /* Rows are whole Mon-Sun weeks: the last day selects WHICH WEEK is last. A
     * window cut mid-week would put some Wednesdays in one column and the rest
     * in another. */
    const rows = weekRowsEnding("2026-08-13", 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].start).toBe("2026-08-10");
    expect(rows[0].days).toEqual([
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13",
      "2026-08-14", "2026-08-15", "2026-08-16",
    ]);
  });

  it("counts back from that week, oldest row first", () => {
    const rows = weekRowsEnding("2026-08-15", 4);
    expect(rows.map((r) => r.start)).toEqual([
      "2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10",
    ]);
  });

  it("gives seven dates in every row, always", () => {
    // No nulls, unlike `calendarRows` which this replaced: a window states its
    // own dates, and a day with no steps is still a day.
    for (const w of WEEK_CHOICES) {
      const rows = weekRowsEnding("2026-08-15", w);
      expect(rows).toHaveLength(w);
      for (const r of rows) expect(r.days).toHaveLength(7);
    }
  });

  it("every row starts on the Monday it names", () => {
    for (const r of weekRowsEnding("2026-08-15", 6)) {
      expect(mondayOf(r.start)).toBe(r.start);
      expect(r.days[0]).toBe(r.start);
    }
  });

  it("is contiguous across rows -- no gap, no overlap", () => {
    const all = weekRowsEnding("2026-08-15", 5).flatMap((r) => r.days);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([...all].sort());
  });

  it("reaches FORWARD when the chosen day is in the plan", () => {
    // The whole point of the window: the sessions two Mondays out were
    // unreachable while the grid was built from measured dates.
    const rows = weekRowsEnding("2026-08-26", 2);
    expect(rows.map((r) => r.start)).toEqual(["2026-08-17", "2026-08-24"]);
  });

  it("crosses a year boundary", () => {
    const rows = weekRowsEnding("2027-01-01", 2);
    expect(rows.map((r) => r.start)).toEqual(["2026-12-21", "2026-12-28"]);
  });

  it("is empty for zero weeks", () => {
    expect(weekRowsEnding("2026-08-15", 0)).toEqual([]);
  });
});

describe("clampWeeks", () => {
  it("keeps every offered choice", () => {
    for (const w of WEEK_CHOICES) expect(clampWeeks(w)).toBe(w);
  });

  it("clamps outside the strip rather than asking for 400 rows", () => {
    expect(clampWeeks(0)).toBe(WEEK_CHOICES[0]);
    expect(clampWeeks(-3)).toBe(WEEK_CHOICES[0]);
    expect(clampWeeks(400)).toBe(WEEK_CHOICES[WEEK_CHOICES.length - 1]);
  });

  it("rounds a fraction", () => {
    expect(clampWeeks(3.4)).toBe(3);
    expect(clampWeeks(3.6)).toBe(4);
  });

  it("falls back for a value that is not a number at all", () => {
    expect(clampWeeks(NaN)).toBe(DEFAULT_WEEKS);
    expect(clampWeeks(Infinity)).toBe(DEFAULT_WEEKS);
  });

  it("the default is one of the choices", () => {
    expect(WEEK_CHOICES).toContain(DEFAULT_WEEKS);
  });
});

describe("over the committed tree", () => {
  it("the default window ends on a date the payload measured", () => {
    if (!PUBLISHED) return;
    const last = defaultLastDay(PUBLISHED)!;
    expect(PUBLISHED.days.some((d) => d.date === last)).toBe(true);
  });

  it("the default window's last row is a week the payload knows", () => {
    if (!PUBLISHED) return;
    const rows = weekRowsEnding(defaultLastDay(PUBLISHED)!, DEFAULT_WEEKS);
    const last = rows[rows.length - 1];
    expect(Object.keys(PUBLISHED.weeks)).toContain(last.start);
  });
});
