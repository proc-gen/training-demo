import { describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { mondayOf } from "@/lib/data/weekDates";
import {
  DEFAULT_WEEKS,
  WEEK_CHOICES,
  clampWeeks,
  defaultLastDay,
  isIsoDate,
  resolveAnchor,
  stepLastDay,
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

// `newestMeasuredDate`'s cases moved to `lib/data/measured.test.ts` with the
// function, when the Trends pace panel became its second consumer.

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

describe("resolveAnchor", () => {
  /* THE ANCHOR IS A QUERY PARAMETER (2026-08-29) AND WAS A ROUTE SEGMENT.
   *
   * A segment had to be ENUMERATED by `generateStaticParams` for the static
   * export, which is the only reason `ANCHOR_MARGIN_WEEKS` ever existed: the
   * demo 404'd twenty-six weeks either side of the record while `stepLastDay`
   * -- right below in this very module -- was deliberately unbounded. The two
   * could not both be satisfied while the anchor lived in the path.
   *
   * What a segment gave for free and a query parameter does not: the value was
   * always one of a list this app produced. Everything below is what has to be
   * checked now that a reader can type it. */
  const FALLBACK = "2026-08-30";

  it("takes a Sunday as it is", () => {
    expect(resolveAnchor("2026-08-30", FALLBACK)).toBe("2026-08-30");
  });

  it("NORMALISES to the week's Sunday", () => {
    /* Every one of a week's seven dates selects the same window and the URL has
     * to name it once, or the same grid exists at seven addresses. The GRID
     * does not need this -- `weekRowsEnding` takes `mondayOf` of whatever it is
     * handed -- the ADDRESS does. */
    for (const d of ["2026-08-24", "2026-08-26", "2026-08-30"]) {
      expect(resolveAnchor(d, FALLBACK), d).toBe("2026-08-30");
    }
  });

  it("falls back where the URL names no anchor", () => {
    expect(resolveAnchor(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveAnchor("", FALLBACK)).toBe(FALLBACK);
  });

  it("falls back rather than trusting a date that does not exist", () => {
    /* `?end=2026-02-31` is a real thing a URL can say and not a real day, and a
     * window bounded by it lands its grid wherever `Date` rolled it over to --
     * a grid that looks fine and is about another month. */
    for (const bad of ["2026-02-31", "2026-13-01", "not-a-date", "20260830"]) {
      expect(resolveAnchor(bad, FALLBACK), bad).toBe(FALLBACK);
    }
  });

  it("takes the first of a repeated parameter", () => {
    // `?end=a&end=b` arrives as an array. The first is what a reader editing a
    // URL by hand means by it.
    expect(resolveAnchor(["2026-08-30", "2026-07-05"], FALLBACK)).toBe("2026-08-30");
  });

  it("is REACHABLE PAST THE RECORD, which the segment could not be", () => {
    /* The athlete's own rule for the arrows, now true of the URL as well:
     * stepping past the record draws a grid of empty cells rather than a 404. */
    expect(resolveAnchor("2019-01-06", FALLBACK)).toBe("2019-01-06");
    expect(resolveAnchor("2099-01-04", FALLBACK)).toBe("2099-01-04");
  });

  it("passes a null fallback through rather than inventing one", () => {
    // Nothing measured and nothing planned: the route reports it. A date made
    // up here would be a window about no data wearing a real-looking address.
    expect(resolveAnchor(undefined, null)).toBeNull();
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

describe("stepLastDay", () => {
  it("moves ONE week at 1w", () => {
    expect(stepLastDay("2026-08-15", 1, -1)).toBe("2026-08-08");
    expect(stepLastDay("2026-08-15", 1, 1)).toBe("2026-08-22");
  });

  it.each(WEEK_CHOICES)(
    "lands the new window FLUSH against the old one at %iw",
    (weeks) => {
      /* THE PROPERTY THAT MATTERS, and the athlete's own statement of it: "if 2
       * weeks is selected, move back and forth by 2 week increments." A window
       * of N rows, stepped back once, must cover exactly the N rows
       * immediately before it -- no gap, no overlap. Asserted by showing that
       * the two windows together ARE the 2N-row window ending where the first
       * one did. */
      const now = weekRowsEnding("2026-08-15", weeks).map((r) => r.start);
      const back = weekRowsEnding(stepLastDay("2026-08-15", weeks, -1), weeks).map(
        (r) => r.start,
      );
      expect([...back, ...now]).toEqual(
        weekRowsEnding("2026-08-15", weeks * 2).map((r) => r.start),
      );
    },
  );

  it.each(WEEK_CHOICES)("is flush going FORWARD too at %iw", (weeks) => {
    const now = weekRowsEnding("2026-08-15", weeks).map((r) => r.start);
    const fwd = stepLastDay("2026-08-15", weeks, 1);
    expect([...now, ...weekRowsEnding(fwd, weeks).map((r) => r.start)]).toEqual(
      weekRowsEnding(fwd, weeks * 2).map((r) => r.start),
    );
  });

  it("crosses a MONTH end", () => {
    expect(stepLastDay("2026-09-05", 1, -1)).toBe("2026-08-29");
  });

  it("crosses a YEAR end", () => {
    expect(stepLastDay("2027-01-02", 1, -1)).toBe("2026-12-26");
    expect(stepLastDay("2026-12-28", 1, 1)).toBe("2027-01-04");
  });

  it("crosses a LEAP DAY", () => {
    // 2028 is a leap year: 02-24 + 7 lands on 03-02, not 03-03.
    expect(stepLastDay("2028-02-24", 1, 1)).toBe("2028-03-02");
    expect(stepLastDay("2028-03-02", 1, -1)).toBe("2028-02-24");
  });

  it("is identity for a zero step", () => {
    expect(stepLastDay("2026-08-15", 4, 0)).toBe("2026-08-15");
  });

  it("is its own inverse", () => {
    for (const w of WEEK_CHOICES) {
      const there = stepLastDay("2026-08-15", w, -1);
      expect(stepLastDay(there, w, 1)).toBe("2026-08-15");
    }
  });

  it("takes MANY steps at once", () => {
    // Nothing calls it this way today; it must not be a ±1 special case.
    expect(stepLastDay("2026-08-15", 1, -3)).toBe(stepLastDay("2026-08-15", 3, -1));
  });

  it("IS NOT BOUNDED BY THE DATA", () => {
    /* The athlete's decision, matching the date field beside it, which has
     * never been bounded either. Stepping past the record draws empty cells,
     * which says more than a dead button can. */
    expect(stepLastDay("2026-08-15", 6, 50)).toBe("2032-05-15");
    expect(stepLastDay("2026-08-15", 6, -50)).toBe("2020-11-14");
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
