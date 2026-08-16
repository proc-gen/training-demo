import { describe, expect, it } from "vitest";

import type { Payload, Week } from "./payload";
import { hasRuns, weekKeys } from "./weeks";

function week(over: Partial<Week>): Week {
  return {
    week_start: "2026-07-27",
    week_end: "2026-08-02",
    notes: { adherence: null, load: null },
    ...over,
  } as Week;
}

function payload(weeks: Record<string, Partial<Week>>): Payload {
  return {
    schema: 1,
    athlete: { slug: "x", display_name: "X" },
    banners: [],
    weeks: Object.fromEntries(
      Object.entries(weeks).map(([k, v]) => [k, week({ week_start: k, ...v })]),
    ),
    days: [],
    adherence_csv: [],
    load_csv: [],
  } as unknown as Payload;
}

describe("weekKeys", () => {
  it("is chronological regardless of insertion order", () => {
    const p = payload({ "2026-08-03": {}, "2026-07-20": {}, "2026-07-27": {} });
    expect(weekKeys(p)).toEqual(["2026-07-20", "2026-07-27", "2026-08-03"]);
  });

  it("is empty for no weeks", () => {
    expect(weekKeys(payload({}))).toEqual([]);
  });

  it("does not throw on a payload with no weeks key at all", () => {
    expect(weekKeys({} as Payload)).toEqual([]);
  });

  it("is deterministic", () => {
    const p = payload({ "2026-08-03": {}, "2026-07-20": {} });
    expect(weekKeys(p)).toEqual(weekKeys(p));
  });
});

describe("hasRuns", () => {
  const w = (adherence: unknown) => week({ adherence } as Partial<Week>);

  it("is true when the week carries a measured run", () => {
    expect(hasRuns(w({ results: [{ id: 1 }] }))).toBe(true);
  });

  it("IS FALSE FOR A WEEK NOBODY HAS RUN YET", () => {
    /* The plan reaches two Mondays ahead and those records are not empty --
     * `facts.miles` is 0.0 and `facts.quality_share` is 0. Good numbers, and
     * not measurements. */
    expect(hasRuns(w({ results: [], facts: { miles: 0 } }))).toBe(false);
  });

  it("reads `results`, not a score", () => {
    // A week that WAS run can score null -- nothing scoreable has come due.
    expect(hasRuns(w({ results: [{ id: 1 }], scores: { week: { pct: null } } }))).toBe(
      true,
    );
  });

  it("is false with no adherence half at all", () => {
    expect(hasRuns(week({}))).toBe(false);
  });

  it("is false for a week that is not there", () => {
    expect(hasRuns(undefined)).toBe(false);
  });
});
