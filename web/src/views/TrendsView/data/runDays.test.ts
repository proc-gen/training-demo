import { describe, expect, it } from "vitest";

import type { Payload, Week } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { addDays } from "./dates";
import { NON_RUN_ROLES, QUALITY_ROLES, qualitySecondsOf, runDays } from "./runDays";

const D = PUBLISHED;

const payload = (weeks: Record<string, unknown>): Payload =>
  ({ weeks, days: [], history: {} }) as unknown as Payload;

/** A week's adherence half: measured runs plus the grader's day count. */
const A = (results: unknown[], elapsed: number) =>
  ({
    adherence: { results, facts: { elapsed_days: elapsed }, scores: {} },
  }) as unknown as Week;

const run = (over: Record<string, unknown>) => ({
  date: "2026-07-27",
  role: "easy",
  miles: 5,
  seconds: 2400,
  ...over,
});

describe("the ported constants", () => {
  it("mirror their Python sources", () => {
    // grade_week.py NON_RUN_ROLES / analyze_session.py QUALITY_ROLES.
    expect(NON_RUN_ROLES).toEqual(["walk", "cross"]);
    expect(QUALITY_ROLES).toEqual(["subt", "interval", "repetition", "goal_pace", "mixed"]);
  });
});

describe("qualitySecondsOf", () => {
  it("counts a race gun to finish", () => {
    expect(qualitySecondsOf({ role: "race", seconds: 1191 })).toBe(1191);
  });

  it("counts a quality session's detected core, and a failed detection as 0", () => {
    expect(
      qualitySecondsOf({ role: "subt", seconds: 3000, detail: { core_seconds: 1800 } }),
    ).toBe(1800);
    // NOT its whole duration: an unsegmentable file must not read as all-quality.
    expect(qualitySecondsOf({ role: "subt", seconds: 3000, detail: {} })).toBe(0);
  });

  it("counts an embedded block only when the PLAN named it", () => {
    const block = [{ dur: 300 }, { dur: 310 }];
    expect(
      qualitySecondsOf({
        role: "long",
        detail: { from_prescription: true, quality_block: block },
      }),
    ).toBe(610);
    // A block the segmenter found on its own is a guess, and contributes 0.
    expect(
      qualitySecondsOf({ role: "long", detail: { quality_block: block } }),
    ).toBe(0);
  });

  it("falls through an EMPTY quality block to the progression -- Python's `or`", () => {
    expect(
      qualitySecondsOf({
        role: "progression",
        detail: { from_prescription: true, quality_block: [], progression: [{ dur: 240 }] },
      }),
    ).toBe(240);
  });

  it("contributes 0 with no detail at all", () => {
    expect(qualitySecondsOf({ role: "easy" })).toBe(0);
    expect(qualitySecondsOf({ role: "easy", detail: null })).toBe(0);
  });
});

describe("runDays", () => {
  it("zero-fills every LIVED day and sums the runs onto theirs", () => {
    const p = payload({
      "2026-07-27": A(
        [run({ date: "2026-07-28", miles: 6, seconds: 3000 })],
        7,
      ),
    });
    const got = runDays(p);
    expect(got.size).toBe(7);
    expect(got.get("2026-07-27")).toEqual({ miles: 0, seconds: 0, qualitySeconds: 0 });
    expect(got.get("2026-07-28")).toEqual({ miles: 6, seconds: 3000, qualitySeconds: 0 });
    expect(got.get("2026-08-02")).toEqual({ miles: 0, seconds: 0, qualitySeconds: 0 });
  });

  it("covers only the days the grader counted on a LIVE week", () => {
    const p = payload({
      "2026-07-27": A([run({})], 3),
    });
    const got = runDays(p);
    // Monday through Wednesday: a Thursday that has not happened is not a zero.
    expect([...got.keys()].sort()).toEqual(["2026-07-27", "2026-07-28", "2026-07-29"]);
  });

  it("contributes NOTHING from a forward-authored plan week", () => {
    const p = payload({
      "2026-08-24": {
        adherence: { results: [], facts: { miles: 0, elapsed_days: 0 }, scores: {} },
      } as unknown as Week,
    });
    expect(runDays(p).size).toBe(0);
  });

  it("keeps walks and hikes out of every figure", () => {
    const p = payload({
      "2026-07-27": A(
        [run({}), run({ role: "walk", miles: 3, seconds: 3600 })],
        7,
      ),
    });
    expect(runDays(p).get("2026-07-27")).toEqual({
      miles: 5,
      seconds: 2400,
      qualitySeconds: 0,
    });
  });

  it("sums the VOLUME quantities where a walking recovery shrank them", () => {
    const p = payload({
      "2026-07-27": A(
        [run({ miles: 0.4, seconds: 503, volume_miles: 0.086, volume_seconds: 22 })],
        7,
      ),
    });
    const day = runDays(p).get("2026-07-27")!;
    expect(day.miles).toBeCloseTo(0.086, 10);
    expect(day.seconds).toBe(22);
  });

  it("lets a measured run prove its day even without elapsed_days", () => {
    const p = payload({
      "2026-07-27": {
        adherence: { results: [run({})], facts: {}, scores: {} },
      } as unknown as Week,
    });
    expect(runDays(p).get("2026-07-27")?.miles).toBe(5);
  });

  it("stacks a double onto one day", () => {
    const p = payload({
      "2026-07-27": A(
        [run({ miles: 3, seconds: 1500 }), run({ miles: 4, seconds: 2000 })],
        7,
      ),
    });
    expect(runDays(p).get("2026-07-27")).toEqual({
      miles: 7,
      seconds: 3500,
      qualitySeconds: 0,
    });
  });
});

describe("the port against the committed tree", () => {
  /* THE CASE THAT MAKES A SECOND IMPLEMENTATION TOLERABLE: summed back over
     each graded week's own days, the ledger must reproduce the grader's weekly
     facts. `toBeCloseTo` because the grader sums km then converts once, while
     the ledger sums per-run miles -- same quantity, different float order. */
  has(D)("re-sums every fully-lived week's facts, day by day", () => {
    let checked = 0;
    const days = runDays(D!);
    for (const [start, week] of Object.entries(D!.weeks)) {
      const facts = (week.adherence?.facts ?? {}) as {
        miles?: number;
        seconds?: number;
        quality_seconds?: number;
        elapsed_days?: number;
      };
      if (facts.elapsed_days !== 7 || !(week.adherence?.results ?? []).length) continue;
      let miles = 0;
      let seconds = 0;
      let quality = 0;
      const end = addDays(start, 6);
      for (const [date, row] of days) {
        if (date >= start && date <= end) {
          miles += row.miles;
          seconds += row.seconds;
          quality += row.qualitySeconds;
        }
      }
      expect(miles, start).toBeCloseTo(facts.miles ?? NaN, 6);
      expect(seconds, start).toBeCloseTo(facts.seconds ?? NaN, 6);
      expect(quality, start).toBeCloseTo(facts.quality_seconds ?? NaN, 6);
      checked++;
    }
    expect(checked).toBeGreaterThan(10); // not a vacuous sweep
  });
});
