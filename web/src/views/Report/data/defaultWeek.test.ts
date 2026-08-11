import { describe, expect, it } from "vitest";

import type { Payload, Week } from "@/lib/data/payload";
import { defaultWeekKey } from "./defaultWeek";

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

// Minimal stand-ins -- only truthiness is read.
const A = { results: [], flags: [] } as unknown as Week["adherence"];
const L = { days: [], flags: [], caveats: [] } as unknown as Week["load"];

describe("defaultWeekKey", () => {
  it("opens on the latest week where BOTH halves graded", () => {
    const p = payload({
      "2026-07-20": { adherence: A, load: L },
      "2026-07-27": { adherence: A, load: L },
      "2026-08-03": { load: L, adherence_error: "payloads not fetched" },
    });
    // 08-03 is newer and its load graded -- but its adherence did not, and
    // opening there shows a wall of banners about a week that hasn't happened.
    expect(defaultWeekKey(p)).toBe("2026-07-27");
  });

  it("falls back to a half-graded week when none graded both", () => {
    const p = payload({
      "2026-07-27": {},
      "2026-08-03": { load: L, adherence_error: "nope" },
    });
    expect(defaultWeekKey(p)).toBe("2026-08-03");
  });

  it("falls back to the newest manifest when nothing graded at all", () => {
    const p = payload({ "2026-07-27": {}, "2026-08-03": {} });
    expect(defaultWeekKey(p)).toBe("2026-08-03");
  });

  it("is null with no weeks", () => {
    expect(defaultWeekKey(payload({}))).toBeNull();
  });

  it("prefers the LATEST fully-graded week, not the first", () => {
    const p = payload({
      "2026-07-20": { adherence: A, load: L },
      "2026-07-27": { adherence: A, load: L },
    });
    expect(defaultWeekKey(p)).toBe("2026-07-27");
  });

  it("prefers a fully-graded OLDER week over a half-graded newer one", () => {
    // The ordering the "either" fallback must not reach when "both" has a hit.
    const p = payload({
      "2026-07-20": { adherence: A, load: L },
      "2026-08-03": { adherence: A, load_error: "no steps" },
    });
    expect(defaultWeekKey(p)).toBe("2026-07-20");
  });
});
