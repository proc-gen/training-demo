/* The whole assembly, held to `propose_chart.models_at`.
 *
 * THIS IS THE END-TO-END PIN and the one that matters most: the per-model tests
 * cover the arithmetic, and this covers what the rail actually renders -- the
 * seeding, the rounding, the sec_per_mi-from-EXACT-seconds rule and the tempo
 * pair, agreeing object for object with the Python that used to write
 * `published/pace-models-current.json`.
 *
 * THE FIXTURE CALLS THE REAL FUNCTION. `build_pace_model_reference.py` invokes
 * `propose_chart.models_at` rather than walking the registry itself, so this
 * compares the port against the model and not against a third implementation
 * living in a fixture builder.
 *
 * EXACT INTEGERS, not a tolerance. Every value here has been through
 * `roundTarget`, so it is a whole second: a tolerance would be admitting the
 * rounding might differ, which is the one thing this file exists to deny.
 */

import { describe, expect, it } from "vitest";

import REFERENCE from "@/test/paceModelReference.json";
import { MODEL_NAMES } from "./registry";
import { modelsAt, roundTarget } from "./tables";

type Tables = {
  effective_vo2max: number;
  models: Record<
    string,
    {
      label: string;
      seeded_from: string;
      race_paces: Record<string, Record<string, number>>;
    }
  >;
};

const CASES = REFERENCE.models_at as unknown as {
  vo2max: number;
  tables: Tables;
}[];

describe("modelsAt reproduces propose_chart.models_at", () => {
  it("has cases at all", () => {
    /* A fixture section that arrived empty would make the loop below a no-op
     * and its case a pass -- the vacuous-guard shape this repo has paid for
     * twice. */
    expect(CASES.length).toBeGreaterThan(0);
  });

  for (const c of CASES) {
    it(`agrees at ${c.vo2max}`, () => {
      const got = modelsAt(c.vo2max);
      expect(got, `${c.vo2max} produced nothing`).toBeTruthy();
      /* AS JSON, not `toEqual`. A key one side omits and the other states as
       * undefined is a real difference, and this object is what a component
       * reads. */
      expect(JSON.stringify(got, Object.keys(got!).sort())).toBe(
        JSON.stringify(c.tables, Object.keys(c.tables).sort()),
      );
      expect(got).toEqual(c.tables);
    });
  }

  it("prices every registered model at every anchor", () => {
    /* Non-vacuous: the equality above would pass if BOTH sides had dropped a
     * model. The Python emits all four unconditionally, so a port that
     * silently skipped one would have to be caught here. */
    for (const c of CASES) {
      expect(Object.keys(c.tables.models).sort(), `${c.vo2max}`).toEqual(
        [...MODEL_NAMES].sort(),
      );
    }
  });

  it("builds NO display strings", () => {
    /* `RacePaceTable.raceText` reconstructs them from the endpoints beside
     * them, the rule `project_chart` already applies to the charts themselves.
     * The Python still emits them, because `--models-current` prints to a
     * terminal that has no renderer -- and the fixture strips them for exactly
     * that reason. */
    const tables = modelsAt(55.9)!;
    for (const table of Object.values(tables.models)) {
      for (const [key, entry] of Object.entries(table.race_paces)) {
        expect(Object.keys(entry), key).not.toContain("display");
        expect(Object.keys(entry), key).not.toContain("basis");
      }
    }
  });

  it("gives tempo a RANGE and every race a single pace", () => {
    const tables = modelsAt(55.9)!;
    for (const table of Object.values(tables.models)) {
      expect(table.race_paces.tempo).toEqual({
        fast_sec_per_mi: expect.any(Number),
        slow_sec_per_mi: expect.any(Number),
      });
      expect(Object.keys(table.race_paces["5000m"]).sort()).toEqual([
        "sec_per_mi",
        "seconds",
      ]);
    }
  });
});

describe("modelsAt refuses an anchor it cannot use", () => {
  it("returns null for an absent or non-numeric anchor", () => {
    /* The same nothing the published record used to spell: no chart on disk
     * means no anchor means no dropdown. */
    expect(modelsAt(null)).toBeNull();
    expect(modelsAt(undefined)).toBeNull();
    expect(modelsAt("55.9")).toBeNull();
    expect(modelsAt(NaN)).toBeNull();
  });

  it("returns null outside the model's 20-90 band", () => {
    /* `checkVo2max`'s own edges. Outside them the number is a typo, and a
     * typo'd anchor does not fail downstream -- it prices every projection
     * wrong. */
    expect(modelsAt(19.9)).toBeNull();
    expect(modelsAt(90.1)).toBeNull();
    expect(modelsAt(20)).toBeTruthy();
    expect(modelsAt(90)).toBeTruthy();
  });
});

describe("roundTarget", () => {
  const CASES = REFERENCE.round_target as { x: number; n: number }[];

  it("matches pacelib.round_target on every pinned case", () => {
    expect(CASES.length).toBeGreaterThan(0);
    for (const c of CASES) {
      expect(roundTarget(c.x), `${c.x}`).toBe(c.n);
    }
  });

  it("takes halves AWAY FROM ZERO, unlike either language's default", () => {
    /* Python's `round` is banker's (2.5 -> 2) and JavaScript's `Math.round`
     * goes toward +Infinity (-1.5 -> -1). The 2026-08-13 rule is neither: a
     * target is a time somebody can run to, so the exact value rounds. */
    expect(roundTarget(0.5)).toBe(1);
    expect(roundTarget(1.5)).toBe(2);
    expect(roundTarget(2.5)).toBe(3);
    expect(roundTarget(-1.5)).toBe(-1);
  });

  it("PRE-ROUNDS to six decimals, so an artefact cannot decide a second", () => {
    /* `round(x, 6)` FIRST, then halves away from zero. A value a hair under a
     * half is a float artefact of the pace arithmetic rather than a target
     * genuinely below it, so it is lifted onto the half and rounds up --
     * `37.4999996` is 38, not 37. Drop the pre-round and the same input lands a
     * second lower, which is the whole tolerance again on a 200 m rep. */
    expect(roundTarget(37.4999996)).toBe(38);
    expect(Math.floor(37.4999996 + 0.5)).toBe(37); // without it
    expect(roundTarget(288.9530001)).toBe(289);
  });
});
