/* The critical-speed port, held to `scripts/pace-models/critical_speed.py`.
 *
 * See `riegel.test.ts` for why the fitted state is asserted beside the
 * predictions. Here it matters most of the three: CS and D' are a slope and an
 * intercept, so a least squares that transposed t and d would still produce a
 * plausible-looking line and every prediction from it would be wrong.
 */

import { describe, expect, it } from "vitest";

import { fitCases, refsOf } from "./fixture";
import {
  MILE_METRES,
  fit,
  paceForDuration,
  raceSeconds,
} from "./criticalSpeed";

describe("critical speed reproduces the Python module", () => {
  for (const [i, c] of fitCases("critical_speed").entries()) {
    const refs = refsOf(c);

    it(`fits and predicts #${i}, ${refs.length} references`, () => {
      const state = fit(refs);
      expect(state[0], "CS m/s").toBeCloseTo(c.state[0], 9);
      expect(state[1], "D' metres").toBeCloseTo(c.state[1], 9);
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

describe("critical speed refuses what the Python module refuses", () => {
  const OK: [number, number][] = [
    [3000, 616],
    [10000, 2270],
  ];

  it("carries the shared mile constant", () => {
    expect(MILE_METRES).toBe(1609.344);
  });

  it("needs two efforts, at two distinct durations", () => {
    expect(() => fit([[5000, 1087]])).toThrow(/at least two/);
    expect(() =>
      fit([
        [3000, 616],
        [3200, 616],
      ]),
    ).toThrow(/two distinct durations/);
  });

  it("refuses a fit with no physical meaning", () => {
    // A longer effort covering LESS distance gives a negative slope.
    expect(() =>
      fit([
        [10000, 616],
        [3000, 2270],
      ]),
    ).toThrow(/not positive/);
  });

  it("refuses a distance inside D prime", () => {
    /* Anaerobic territory the model prices at zero aerobic time. It is why the
     * fixture's `race_seconds` rows are filtered rather than exhaustive. */
    const state = fit(OK);
    expect(state[1]).toBeGreaterThan(100);
    expect(() => raceSeconds(state, Math.floor(state[1]))).toThrow(/inside D/);
  });

  it("refuses a distance outside 100 m to 500 km, and a bad duration", () => {
    const state = fit(OK);
    expect(() => raceSeconds(state, 50)).toThrow(/out of range/);
    expect(() => raceSeconds(state, 600_000)).toThrow(/out of range/);
    expect(() => paceForDuration(state, 0)).toThrow(/positive/);
  });

  it("agrees with its own linear form", () => {
    /* d = CS*t + D', stated the other way round. The one identity the model IS,
     * and a transposed regression would fail it. */
    const [cs, dPrime] = fit(OK);
    const t = raceSeconds([cs, dPrime], 5000);
    expect(cs * t + dPrime).toBeCloseTo(5000, 6);
  });
});
