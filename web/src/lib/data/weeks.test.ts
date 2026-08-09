import { describe, expect, it } from "vitest";

import type { Payload, Week } from "./payload";
import { weekKeys } from "./weeks";

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
