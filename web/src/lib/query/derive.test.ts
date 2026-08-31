/* The derivation port, held to the Python it was ported from.
 *
 * THIS IS THE PIN THE READER-EQUALITY TESTS CANNOT BE.
 * `assemblePayload() == assembleFromRecords()` is the safety net for the whole
 * index, and it is blind to exactly this: both sides call `derive.ts`, so they
 * agree with each other however wrong they both are. The Python half is pinned
 * for free -- `test_publish.py::TestTheRoundTrip` asserts
 * `unpublish(publish(x)) == x` leaf for leaf over the real tree -- and this
 * carries that guarantee across the language boundary.
 *
 * `derivationsReference.json` is generated from `scripts/derivations.py` by
 * `tests/fixtures/build_derivations_reference.py`: every derived leaf of two
 * real weeks, as PYTHON computes it. The cases below rebuild those weeks from
 * the same stored records through `readWeek()` and compare.
 *
 * EXACT, NOT `toBeCloseTo`. The point is that both sides run the same
 * EXPRESSION in the same order over IEEE 754 doubles -- `MI_PER_KM` is
 * `1 / 1.609344` and every conversion multiplies by it, because
 * `km / 1.609344` differs in the last bit on about one value in forty. A
 * tolerance here would hide precisely the class of mistake this exists to
 * catch: the Python side wrote the division first and 18 real leaves
 * disagreed.
 */

import { describe, expect, it } from "vitest";

import REFERENCE from "@/test/derivationsReference.json";
import { readWeek } from "../db/records";
import { athleteSlugs } from "../repository";
import {
  DAY_JOIN_KEYS,
  MI_PER_KM,
  daysByDate,
  deriveAdherence,
  deriveLoad,
  joinDates,
} from "./derive";

const SLUG = athleteSlugs()[0] ?? null;
const has = (x: unknown) => (x ? it : it.skip);

/** Flatten a record the way the fixture builder does. */
function leaves(obj: unknown, path = "", out: Record<string, unknown> = {}) {
  if (obj !== null && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      leaves(v, path ? `${path}.${k}` : k, out);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  } else {
    out[path] = obj;
  }
  return out;
}

describe("the port reproduces the Python restore", () => {
  const weeks = Object.entries(REFERENCE.weeks) as [
    string,
    Record<string, unknown>,
  ][];

  it("the fixture is there and is not empty", () => {
    /* NON-VACUOUS. Every case below iterates the fixture, and an empty one
     * would make each of them pass having compared nothing -- the shape this
     * repo has paid for in `test_pace_group_constants` and again in
     * `test_hr_stream_mismatch`. */
    expect(weeks.length).toBeGreaterThan(1);
    for (const [start, derived] of weeks) {
      expect(Object.keys(derived).length, start).toBeGreaterThan(100);
    }
  });

  for (const [start, derived] of weeks) {
    has(SLUG)(`reproduces every derived leaf of ${start}`, () => {
      const week = readWeek(SLUG!, start) as {
        adherence: unknown;
        load: unknown;
      };
      const got = {
        ...leaves(week.adherence),
        ...Object.fromEntries(
          Object.entries(leaves(week.load)).map(([k, v]) => [`load.${k}`, v]),
        ),
      };
      const bad: string[] = [];
      for (const [path, want] of Object.entries(derived)) {
        if (!Object.is(got[path], want)) {
          bad.push(`${path}: python ${want}, typescript ${got[path]}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  has(SLUG)("covers all four adherence shapes and all five load ones", () => {
    /* The fixture is two weeks, so it could in principle exercise only some of
       the formulas. This says which ones it reaches, so a future edit to
       `WEEKS` cannot quietly shrink the corpus. */
    const paths = weeks.flatMap(([, d]) => Object.keys(d));
    for (const marker of [
      ".miles",
      ".pace",
      ".pct",
      "detail.laps[0].end",
      "load.days[0].se",
      "load.days[0].tsb",
      "load.fitness.acwr_run",
      "load.overall",
      "load.readiness.passed",
    ]) {
      expect(
        paths.some((p) => p.includes(marker)),
        `no derived leaf matches ${marker}`,
      ).toBe(true);
    }
  });
});

describe("the two rules the pair is built on", () => {
  it("fills an absence and NEVER overwrites", () => {
    /* `_drop` on the Python side removes a field only where the formula
     * reproduces it, so a stored value is one the formula did NOT match.
     * Overwriting it here would substitute the number that was measured to be
     * wrong -- the strip's whole care, undone by the restore. */
    const rec = deriveAdherence({
      results: [{ km: 10, miles: 99 }],
    }) as { results: { miles: number }[] };
    expect(rec.results[0].miles).toBe(99);
  });

  it("computes only when every input is PRESENT", () => {
    const rec = deriveAdherence({
      results: [{ seconds: 100 }],
    }) as { results: Record<string, unknown>[] };
    // No `km`, so no `miles`; no `miles`, so no `pace`. Absent, not null.
    expect("miles" in rec.results[0]).toBe(false);
    expect("pace" in rec.results[0]).toBe(false);
  });

  it("treats a published null as a value the formula runs over", () => {
    const rec = deriveAdherence({
      results: [{ km: null }],
    }) as { results: Record<string, unknown>[] };
    expect("miles" in rec.results[0]).toBe(true);
    expect(rec.results[0].miles).toBeNull();
  });

  it("multiplies by MI_PER_KM rather than dividing", () => {
    /* The two are different doubles. This is the case that would have caught
       the Python side's original spelling. */
    const rec = deriveAdherence({ results: [{ km: 11.998677722102919 / MI_PER_KM }] }) as {
      results: { miles: number }[];
    };
    const km = 11.998677722102919 / MI_PER_KM;
    expect(rec.results[0].miles).toBe(km * MI_PER_KM);
  });
});

describe("the load join", () => {
  const day = {
    date: "2026-01-01",
    total_steps: 10,
    run_steps: 6,
    nonrun_steps: 4,
    run_step_source: "cadence-stream",
    completeness: "full",
  };

  it("takes four columns off the day record and not the fifth", () => {
    const load = deriveLoad(
      { days: [{ date: "2026-01-01", completeness: "in-progress" }] },
      daysByDate([day]),
    ) as { days: Record<string, unknown>[] };
    for (const key of DAY_JOIN_KEYS) expect(load.days[0][key]).toBe(day[key]);
    /* `completeness` IS NOT JOINED. Same key, two vocabularies: only the
       grader can say `in-progress`, because the parser has no clock. */
    expect(load.days[0].completeness).toBe("in-progress");
  });

  it("leaves the columns absent for a date with no day record", () => {
    /* Today's row exists only once an export covers it, and the grader still
       builds the day. Absent, never zero-filled. */
    const load = deriveLoad(
      { days: [{ date: "2026-01-02" }] },
      daysByDate([day]),
    ) as { days: Record<string, unknown>[] };
    for (const key of DAY_JOIN_KEYS) expect(key in load.days[0]).toBe(false);
  });

  it("names the dates its own record states", () => {
    expect(joinDates({ days: [{ date: "a" }, {}, { date: "b" }] })).toEqual([
      "a",
      "b",
    ]);
    expect(joinDates(null)).toEqual([]);
  });

  it("sums a week in published order, skipping unmeasured days", () => {
    const load = deriveLoad(
      { days: [{ trimp: 1.5 }, { trimp: null }, { trimp: 2.25 }] },
      new Map(),
    ) as { bg_trimp: number; fitness?: unknown };
    expect(load.bg_trimp).toBe(0);
    const withFitness = deriveLoad(
      { days: [{ trimp: 1.5 }, { trimp: null }, { trimp: 2.25 }], fitness: {} },
      new Map(),
    ) as { fitness: { trimp: number } };
    expect(withFitness.fitness.trimp).toBe(3.75);
  });

  it("reads ctl and atl off the day `on_date` names", () => {
    const load = deriveLoad(
      {
        days: [
          { date: "d1", ctl: 10, atl: 5 },
          { date: "d2", ctl: 20, atl: 30 },
        ],
        fitness: { on_date: "d2" },
      },
      new Map(),
    ) as { fitness: Record<string, number> };
    expect(load.fitness.ctl).toBe(20);
    expect(load.fitness.atl).toBe(30);
    expect(load.fitness.tsb).toBe(-10);
    expect(load.fitness.acwr_run).toBe(1.5);
  });

  it("counts readiness passes and states no percentage without a total", () => {
    const load = deriveLoad(
      {
        readiness: {
          per_day: [
            { checks: { a: true, b: false } },
            { checks: { a: true, b: true } },
          ],
          available: 4,
        },
      },
      new Map(),
    ) as { readiness: Record<string, number | null> };
    expect(load.readiness.passed).toBe(3);
    expect(load.readiness.pct).toBe(75);
  });

  it("states no percentage where the denominator is zero", () => {
    // 0/0 is not 0%. A week nothing came due in is a real state, and a `0`
    // here would render as a total failure.
    const load = deriveLoad(
      { integrity: { earned: 0, total: 0 } },
      new Map(),
    ) as { integrity: { pct: number | null }; overall?: unknown };
    expect(load.integrity.pct).toBeNull();
    expect("overall" in load).toBe(false);
  });
});
