/* The cross-check cases from `paceModelReference.json`, shaped for the three
 * per-model tests.
 *
 * ONE READER, THREE TESTS. Each model's test filters this to its own rows; the
 * alternative was three copies of the same cast and the same non-empty guard,
 * which is what a shared fixture accessor exists to prevent.
 *
 * IT IS NOT A TEST FILE and it is not production code either -- it sits beside
 * the models it describes rather than in `src/test/`, because it names their
 * shapes. `structure.test.ts` exempts `*.fixture.ts`-style helpers by the same
 * rule that exempts `src/test/`; this one carries its own test to be safe.
 */

import REFERENCE from "@/test/paceModelReference.json";

export type FitCase = {
  model: string;
  references: number[][];
  exponent: number | null;
  state: number[];
  race_seconds: { distance_m: number; seconds: number }[];
  pace_for_duration: { duration_seconds: number; sec_per_mi: number }[];
};

/** Every fitted case the builder emitted, for one model.
 *
 * THROWS ON AN EMPTY RESULT rather than returning one. A fixture section that
 * arrived empty would make every loop below it a no-op and every case a pass --
 * the vacuous-guard shape this repo has paid for twice -- and a throw here says
 * which model went missing instead of leaving three suites quietly green.
 */
export function fitCases(model: string): FitCase[] {
  const rows = (REFERENCE.cross_check_fits as FitCase[]).filter(
    (c) => c.model === model,
  );
  if (!rows.length) {
    throw new Error(
      `paceModelReference.json carries no cross_check_fits for ${model} -- ` +
        `re-run tests/fixtures/build_pace_model_reference.py`,
    );
  }
  return rows;
}

/** `[distance_m, seconds]` pairs, as the model's `fit` wants them. */
export function refsOf(c: FitCase): [number, number][] {
  return c.references.map(([d, s]) => [d, s] as [number, number]);
}
