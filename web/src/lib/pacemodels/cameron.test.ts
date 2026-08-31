/* The Cameron port, held to `scripts/pace-models/cameron.py`.
 *
 * See `riegel.test.ts` for why the fitted state is asserted beside the
 * predictions, and `danielsGilbert.test.ts` for why a port may exist at all.
 *
 * CAMERON HAS NO FREE PARAMETER, so its "fit" is a validated reference and the
 * arithmetic worth pinning is the ENDURANCE FACTOR and the bisection that
 * inverts it. 200 halvings are exact to double precision, which is what makes
 * `paceForDuration` identical bit for bit on both sides rather than close.
 */

import { describe, expect, it } from "vitest";

import { fitCases, refsOf } from "./fixture";
import {
  DOMAIN_METRES,
  ENDURANCE,
  MILE_METRES,
  fit,
  paceForDuration,
  raceSeconds,
} from "./cameron";

describe("cameron reproduces the Python module", () => {
  for (const [i, c] of fitCases("cameron").entries()) {
    const refs = refsOf(c);

    it(`fits and predicts #${i}`, () => {
      const state = fit(refs);
      expect(state[0]).toBeCloseTo(c.state[0], 9);
      expect(state[1]).toBeCloseTo(c.state[1], 9);
      expect(c.race_seconds.length).toBeGreaterThan(0);
      for (const row of c.race_seconds) {
        expect(
          raceSeconds(state, row.distance_m),
          `${row.distance_m} m`,
        ).toBeCloseTo(row.seconds, 9);
      }
      expect(c.pace_for_duration.length).toBeGreaterThan(0);
      for (const row of c.pace_for_duration) {
        expect(
          paceForDuration(state, row.duration_seconds),
          `${row.duration_seconds} s`,
        ).toBeCloseTo(row.sec_per_mi, 9);
      }
    });
  }
});

describe("cameron refuses what the Python module refuses", () => {
  it("carries the published coefficients", () => {
    /* The metre form of the mile coefficients (13.49681, 0.048865, 2.438936
     * over miles^0.7905), converted exactly. A typo here moves every
     * prediction by seconds while leaving the curve's shape intact, which is
     * the kind of wrong nobody notices by looking. */
    expect(ENDURANCE).toEqual([13.49681, 0.000030363, 835.7114, 0.7905]);
    expect(MILE_METRES).toBe(1609.344);
  });

  it("takes exactly one reference and nothing else", () => {
    expect(() => fit([])).toThrow(/exactly one/);
    expect(() =>
      fit([
        [5000, 1087],
        [10000, 2270],
      ]),
    ).toThrow(/exactly one/);
  });

  it("stops at 100 km, its OWN monotone edge", () => {
    /* NOT the repo-wide 500 km bound the other models carry: the linear term
     * drives f negative past ~444 km and predicted time stops rising well
     * before that, so the bisection would converge on the wrong root. */
    expect(DOMAIN_METRES).toEqual([100, 100_000]);
    const state = fit([[5000, 1087]]);
    expect(() => raceSeconds(state, 200_000)).toThrow(/out of range/);
    expect(() => fit([[200_000, 40_000]])).toThrow(/out of range/);
  });

  it("refuses a duration that resolves outside its distance range", () => {
    const state = fit([[5000, 1087]]);
    expect(() => paceForDuration(state, 0)).toThrow(/positive/);
    expect(() => paceForDuration(state, 5)).toThrow(/outside/);
  });

  it("inverts its own prediction", () => {
    /* The bisection's whole contract: pricing a duration must land back on the
     * distance whose prediction is that duration. */
    const state = fit([[5000, 1087]]);
    const seconds = raceSeconds(state, 10000);
    expect(seconds / (10000 / MILE_METRES)).toBeCloseTo(
      paceForDuration(state, seconds),
      6,
    );
  });
});
