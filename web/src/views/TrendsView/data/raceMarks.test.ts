/* The graded races, asserted against the committed `published/` tree plus
 * synthetic edges. Counts are derived and floor-compared, never pinned -- the
 * record grows, and a pinned count is a number nobody re-derives.
 */

import { describe, expect, it } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";
import { raceMarks } from "./raceMarks";

const P = PUBLISHED;
const marks = P ? raceMarks(P) : [];

describe("raceMarks over the committed tree", () => {
  has(P)("finds every graded race, oldest week first", () => {
    // Ten on the record today; a floor, because the athlete keeps racing.
    expect(marks.length).toBeGreaterThanOrEqual(10);
    const dates = marks.map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
  });

  has(P)("carries finite positive quantities on every mark", () => {
    for (const m of marks) {
      expect(Number.isFinite(m.seconds) && m.seconds > 0).toBe(true);
      expect(Number.isFinite(m.pace) && m.pace > 0).toBe(true);
      if (m.totalMi !== null) {
        expect(Number.isFinite(m.totalMi) && m.totalMi > 0).toBe(true);
      }
    }
  });

  has(P)("PINS THE 2026-07-19 TRACK 5K -- the worked example", () => {
    const m = marks.find((x) => x.date === "2026-07-19")!;
    expect(m.seconds).toBe(1152);
    expect(m.pace).toBeCloseTo(372.8, 1);
    expect(m.totalMi).toBeCloseTo(3.09, 2);
  });

  has(P)("keeps the DISTANCE-LESS races -- races do not attach to a series", () => {
    /* Mountain (2025-06-14) and the trail race (2025-11-29) name no
       distance the panel plots and appear anyway -- the athlete's ruling:
       *"races don't go on lines. they should just get points on the chart."* */
    const dates = marks.map((m) => m.date);
    expect(dates).toContain("2025-06-14");
    expect(dates).toContain("2025-11-29");
  });

  has(P)("takes every mark from a MEASURED result, never from the plan", () => {
    /* A planned race has no `detail.race` -- nothing has been measured -- so a
       race two Mondays out contributes nothing by construction rather than by
       a date comparison. */
    const measured = new Set(
      weekKeys(P!).flatMap((k) =>
        (P!.weeks[k]?.adherence?.results ?? []).map((r) => r.date ?? ""),
      ),
    );
    for (const m of marks) expect(measured.has(m.date)).toBe(true);
  });
});

describe("raceMarks edges", () => {
  const payload = (results: unknown[]): Payload =>
    ({
      weeks: {
        "2026-07-13": { week_start: "2026-07-13", adherence: { results } },
      },
    }) as never;

  it("emits nothing for a run without a race detail", () => {
    expect(
      raceMarks(payload([{ date: "2026-07-19", detail: { sets: [] } }])),
    ).toEqual([]);
  });

  it("REFUSES a zero or missing quantity rather than plotting it", () => {
    // `0` is falsy AND not a finishing time -- the test is on finite positive,
    // never truthiness.
    const bad = [
      { date: "2026-07-19", detail: { race: { seconds: 0, pace: 372.8 } } },
      { date: "2026-07-19", detail: { race: { seconds: 1152, pace: null } } },
      { date: "2026-07-19", detail: { race: { seconds: null, pace: 372.8 } } },
    ];
    expect(raceMarks(payload(bad))).toEqual([]);
  });

  it("nulls a distance it cannot trust and keeps the mark", () => {
    const got = raceMarks(
      payload([
        { date: "2026-07-19", detail: { race: { seconds: 1152, pace: 372.8, total_mi: 0 } } },
      ]),
    );
    expect(got).toHaveLength(1);
    expect(got[0].totalMi).toBeNull();
  });

  it("skips a row with no date", () => {
    expect(
      raceMarks(payload([{ detail: { race: { seconds: 1152, pace: 372.8 } } }])),
    ).toEqual([]);
  });

  it("never reads the planned list", () => {
    const p = {
      weeks: {
        "2026-09-07": {
          week_start: "2026-09-07",
          adherence: {
            results: [],
            planned: [
              { date: "2026-09-12", detail: { race: { seconds: 1111, pace: 350 } } },
            ],
          },
        },
      },
    } as never;
    expect(raceMarks(p)).toEqual([]);
  });
});
