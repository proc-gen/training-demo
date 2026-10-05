/* The workouts-and-long-runs VO2max line: which activities count, and the
 * windowed mean over them.
 *
 * The rule is small and the ways to get it wrong are not: a warmup has no
 * emphasis and must count, a hill sprint HAS emphasis and must not, an
 * activity no week names is neither, and a window holding one unknown
 * activity must draw nothing rather than a mean over the known half. Every
 * one of those is a case below.
 */

import { describe, expect, it } from "vitest";

import { ROLES } from "@/lib/manifest/vocab";
import type { Payload, Vo2maxRow } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";

import { addDays } from "./dates";
import { samples, shape } from "./vo2maxCurve";
import {
  activityClasses,
  counts,
  EXCLUDED_ROLES,
  type SubsetSample,
  subsetSamples,
  subsetShape,
  SUPPORT_ROLES,
} from "./vo2maxSubset";

/* ------------------------------------------------------------- builders */

const result = (runalyze_id: unknown, role: string, emphasis: unknown = []) => ({
  runalyze_id,
  role,
  emphasis,
});

const payloadOf = (weeks: Record<string, unknown[]>, rows: Partial<Vo2maxRow>[] = []) =>
  ({
    weeks: Object.fromEntries(
      Object.entries(weeks).map(([k, results]) => [k, { adherence: { results } }]),
    ),
    days: [],
    vo2max: rows,
  }) as unknown as Payload;

const row = (
  activity_id: number,
  date: string,
  vo2max: number,
  distance_km = 10,
): Partial<Vo2maxRow> => ({ activity_id, date, vo2max, distance_km, estimate_source: "payload" });

const sample = (
  date: string,
  vo2max: number,
  distanceKm: number,
  included: boolean | null,
): SubsetSample => ({ date, vo2max, distanceKm, included });

/* ---------------------------------------------------------------- counts */

describe("counts", () => {
  it("counts a run the grader stamped with any emphasis", () => {
    expect(counts("subt", ["quality"])).toBe(true);
    expect(counts("long", ["long"])).toBe(true);
    expect(counts("race", ["race"])).toBe(true);
    expect(counts("time_trial", ["quality"])).toBe(true);
    expect(counts("progression", ["long", "quality"])).toBe(true);
    expect(counts("hill_repeats", ["quality"])).toBe(true);
  });

  it("counts an EASY run flagged is_long -- the emphasis says long, not the role", () => {
    expect(counts("easy", ["long"])).toBe(true);
  });

  it("does not count an easy or recovery run with no emphasis", () => {
    expect(counts("easy", [])).toBe(false);
    expect(counts("recovery", [])).toBe(false);
  });

  it("counts a warmup and a cooldown though they carry no emphasis", () => {
    expect(counts("warmup", [])).toBe(true);
    expect(counts("cooldown", [])).toBe(true);
    expect(counts("warmup", null)).toBe(true);
    expect(counts("cooldown", undefined)).toBe(true);
  });

  it("NEVER counts hill sprints, whatever their emphasis says", () => {
    expect(counts("neuromuscular", ["quality"])).toBe(false);
    expect(counts("neuromuscular", ["long", "quality"])).toBe(false);
    expect(counts("neuromuscular", [])).toBe(false);
  });

  it("does not count a non-running day", () => {
    expect(counts("walk", [])).toBe(false);
    expect(counts("cross", [])).toBe(false);
  });

  it("reads a missing or malformed emphasis as none", () => {
    expect(counts("easy", null)).toBe(false);
    expect(counts("easy", undefined)).toBe(false);
    expect(counts("easy", "quality")).toBe(false);
    expect(counts("easy", {})).toBe(false);
  });

  it("does not trip on a missing role", () => {
    expect(counts(undefined, ["quality"])).toBe(true);
    expect(counts(undefined, [])).toBe(false);
    expect(counts(null, null)).toBe(false);
  });
});

describe("the role tokens are real roles", () => {
  it("names only tokens the manifest vocabulary has", () => {
    for (const r of [...SUPPORT_ROLES, ...EXCLUDED_ROLES]) expect(ROLES, r).toContain(r);
  });

  it("never lists one role on both sides", () => {
    for (const r of SUPPORT_ROLES) expect(EXCLUDED_ROLES).not.toContain(r);
  });
});

/* ------------------------------------------------------- activityClasses */

describe("activityClasses", () => {
  it("is empty with no weeks, no adherence or no results", () => {
    expect(activityClasses(payloadOf({})).size).toBe(0);
    expect(activityClasses({ weeks: { a: {} } } as unknown as Payload).size).toBe(0);
    expect(
      activityClasses({ weeks: { a: { adherence: null } } } as unknown as Payload).size,
    ).toBe(0);
    expect(activityClasses({ weeks: { a: null } } as unknown as Payload).size).toBe(0);
    expect(activityClasses({} as unknown as Payload).size).toBe(0);
  });

  it("classifies every graded run by its id, across weeks", () => {
    const m = activityClasses(
      payloadOf({
        "2026-09-21": [result(1, "easy"), result(2, "subt", ["quality"])],
        "2026-09-28": [result(3, "warmup"), result(4, "neuromuscular", ["quality"])],
      }),
    );
    expect([...m.entries()]).toEqual([
      ["1", false],
      ["2", true],
      ["3", true],
      ["4", false],
    ]);
  });

  it("puts a numeric and a string id on one footing", () => {
    const m = activityClasses(payloadOf({ w: [result("42", "long", ["long"])] }));
    expect(m.get("42")).toBe(true);
    expect(m.get(String(42))).toBe(true);
  });

  it("skips a PLANNED run -- no id, nothing to classify", () => {
    const m = activityClasses(
      payloadOf({ w: [result(null, "long", ["long"]), result(undefined, "race", ["race"]), result("", "subt", ["quality"])] }),
    );
    expect(m.size).toBe(0);
  });

  it("counts an activity two rows name if EITHER says it counts", () => {
    const either = activityClasses(
      payloadOf({ a: [result(7, "easy")], b: [result(7, "long", ["long"])] }),
    );
    expect(either.get("7")).toBe(true);
    const reversed = activityClasses(
      payloadOf({ a: [result(7, "long", ["long"])], b: [result(7, "easy")] }),
    );
    expect(reversed.get("7")).toBe(true);
    const neither = activityClasses(payloadOf({ a: [result(7, "easy")], b: [result(7, "recovery")] }));
    expect(neither.get("7")).toBe(false);
  });
});

/* --------------------------------------------------------- subsetSamples */

describe("subsetSamples", () => {
  const classes = new Map([
    ["1", true],
    ["2", false],
  ]);

  it("marks counted, not counted and unknown", () => {
    const got = subsetSamples(
      [row(1, "2026-01-01", 50), row(2, "2026-01-02", 60), row(3, "2026-01-03", 55)] as Vo2maxRow[],
      classes,
    );
    expect(got.map((s) => s.included)).toEqual([true, false, null]);
  });

  it("reads a row with no activity id as unknown", () => {
    const got = subsetSamples(
      [{ date: "2026-01-01", vo2max: 50, distance_km: 5 }] as Vo2maxRow[],
      classes,
    );
    expect(got[0].included).toBeNull();
  });

  it("keeps exactly the rows samples() keeps, in exactly its order", () => {
    /* Same filter, same stable sort: the subset line sums its activities in
       the order the plain line does, two doubles on one date included. */
    const rows = [
      row(1, "2026-01-03", 50),
      row(2, "2026-01-01", 60),
      row(1, "2026-01-01", 61, 4),
      row(2, "2026-01-02", 70, 0), // unweightable -- dropped by both
      { activity_id: 1, date: "2026-01-02", distance_km: 5 }, // declined -- dropped by both
      row(1, "", 50), // no date -- dropped by both
    ] as Vo2maxRow[];
    const plain = samples(rows);
    const got = subsetSamples(rows, classes);
    expect(got.map(({ date, vo2max, distanceKm }) => ({ date, vo2max, distanceKm }))).toEqual(plain);
  });

  it("is empty for no rows", () => {
    expect(subsetSamples(undefined, classes)).toEqual([]);
    expect(subsetSamples([], classes)).toEqual([]);
  });
});

/* ----------------------------------------------------------- subsetShape */

describe("subsetShape", () => {
  it("is the distance-weighted mean over the counted samples only", () => {
    const S = [
      sample("2026-01-01", 50, 10, true),
      sample("2026-01-02", 70, 30, false),
      sample("2026-01-03", 60, 30, true),
    ];
    const got = subsetShape(S, "2026-01-03", 42)!;
    expect(got.value).toBe((50 * 10 + 60 * 30) / 40);
    expect(got.count).toBe(2);
  });

  it("equals shape() when every sample counts", () => {
    const S = [
      sample("2026-01-01", 50, 10, true),
      sample("2026-01-05", 62, 7, true),
      sample("2026-01-20", 58, 21, true),
    ];
    for (const asOf of ["2026-01-01", "2026-01-10", "2026-01-20", "2026-02-20"]) {
      for (const w of [1, 7, 30, 42]) {
        expect(subsetShape(S, asOf, w), `${asOf} ${w}`).toEqual(shape(S, asOf, w));
      }
    }
  });

  it("is null when nothing in the window counts", () => {
    const S = [sample("2026-01-01", 50, 10, false), sample("2026-01-02", 60, 10, false)];
    expect(subsetShape(S, "2026-01-02", 42)).toBeNull();
    expect(subsetShape([], "2026-01-02", 42)).toBeNull();
  });

  it("is NULL when ONE unknown activity is in the window -- never a mean over the known part", () => {
    const S = [
      sample("2026-01-01", 50, 10, null),
      sample("2026-01-02", 60, 10, true),
    ];
    expect(subsetShape(S, "2026-01-02", 42)).toBeNull();
    // An unknown that does not count either way still blanks the window.
    const S2 = [sample("2026-01-01", 50, 10, true), sample("2026-01-02", 60, 10, null)];
    expect(subsetShape(S2, "2026-01-02", 42)).toBeNull();
  });

  it("draws again once the unknown activity has left the window", () => {
    const S = [sample("2026-01-01", 50, 10, null), sample("2026-01-20", 60, 10, true)];
    expect(subsetShape(S, "2026-01-20", 20)).toBeNull(); // 01-01 .. 01-20
    expect(subsetShape(S, "2026-01-20", 19)!.value).toBe(60); // 01-02 .. 01-20
  });

  it("ignores an unknown activity AFTER the as-of date", () => {
    const S = [sample("2026-01-01", 50, 10, true), sample("2026-01-05", 60, 10, null)];
    expect(subsetShape(S, "2026-01-04", 42)!.value).toBe(50);
  });

  it("is inclusive at both ends, windowDays - 1 back -- shape()'s own edges", () => {
    const S = [
      sample("2026-01-01", 50, 10, true),
      sample("2026-01-10", 60, 10, true),
    ];
    expect(subsetShape(S, "2026-01-10", 10)!.count).toBe(2); // 01-01 .. 01-10
    expect(subsetShape(S, "2026-01-10", 9)!.count).toBe(1); // 01-02 .. 01-10
    expect(subsetShape(S, "2026-01-01", 1)!.value).toBe(50);
  });

  it("is deterministic", () => {
    const S = [sample("2026-01-01", 50.123, 3.7, true), sample("2026-01-01", 61.9, 9.1, true)];
    expect(subsetShape(S, "2026-01-01", 42)).toEqual(subsetShape(S, "2026-01-01", 42));
  });
});

/* --------------------------------------------------------- the real tree */

describe("over the published tree", () => {
  const P = PUBLISHED;

  has(P)("classifies something -- the line is not vacuous", () => {
    const m = activityClasses(P!);
    expect([...m.values()].filter(Boolean).length).toBeGreaterThan(0);
    expect([...m.values()].filter((v) => !v).length).toBeGreaterThan(0);
  });

  has(P)("excludes every hill-sprint file and counts every warmup, cooldown, long run and race", () => {
    const m = activityClasses(P!);
    let seen = 0;
    for (const week of Object.values(P!.weeks ?? {})) {
      for (const r of (week?.adherence?.results ?? []) as Record<string, unknown>[]) {
        if (r.runalyze_id == null) continue;
        const got = m.get(String(r.runalyze_id));
        const emphasis = (r.emphasis ?? []) as string[];
        if (r.role === "neuromuscular") expect(got, String(r.runalyze_id)).toBe(false);
        if (r.role === "warmup" || r.role === "cooldown") expect(got).toBe(true);
        if (emphasis.includes("long") || emphasis.includes("race")) expect(got).toBe(true);
        if ((r.role === "easy" || r.role === "recovery") && !emphasis.length) {
          expect(got).toBe(false);
        }
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  has(P)("draws on the newest day, and draws nothing over the era no manifest names", () => {
    const S = subsetSamples(P!.vo2max, activityClasses(P!));
    const last = S[S.length - 1].date;
    expect(subsetShape(S, last, 42)).not.toBeNull();
    expect(subsetShape(S, last, 30)).not.toBeNull();
    // The first estimate predates every manifest, so the day it happened can
    // only be unknown.
    expect(S[0].included).toBeNull();
    expect(subsetShape(S, S[0].date, 42)).toBeNull();
    // And a full window after the last unknown activity, it draws.
    const lastUnknown = [...S].reverse().find((s) => s.included === null)!.date;
    expect(subsetShape(S, addDays(lastUnknown, 42), 42)).not.toBeNull();
  });

  has(P)("stays inside the model's admissible band wherever it draws", () => {
    const S = subsetSamples(P!.vo2max, activityClasses(P!));
    for (let d = S[0].date; d <= S[S.length - 1].date; d = addDays(d, 7)) {
      for (const w of [30, 42]) {
        const got = subsetShape(S, d, w);
        if (!got) continue;
        expect(got.value).toBeGreaterThan(20);
        expect(got.value).toBeLessThan(90);
      }
    }
  });
});
