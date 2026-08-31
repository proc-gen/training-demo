/* The Riegel port, held to `scripts/pace-models/riegel.py`.
 *
 * `danielsGilbert.test.ts` states the whole argument for why a port may exist:
 * the rule is against an UNPINNED second implementation, and the fixture built
 * by `tests/fixtures/build_pace_model_reference.py` is the pin.
 *
 * THE FITTED STATE IS ASSERTED, NOT ONLY THE PREDICTIONS. Every table the rail
 * draws is seeded from a Daniels-Gilbert prediction, and a ONE-reference fit
 * reproduces its own seed whatever the arithmetic does -- so a broken least
 * squares would agree on everything the app renders and diverge the first time
 * a real reference was passed. The multi-point case is what reaches it.
 *
 * 1e-9 rather than exact, for the fixture's JSON round trip. It cannot hide a
 * wrong exponent: 1.06 against 1.07 moves a marathon prediction by minutes.
 */

import { describe, expect, it } from "vitest";

import { fitCases, refsOf } from "./fixture";
import {
  DEFAULT_EXPONENT,
  EXPONENT_BAND,
  MILE_METRES,
  fit,
  paceForDuration,
  raceSeconds,
} from "./riegel";

describe("riegel reproduces the Python module", () => {
  for (const [i, c] of fitCases("riegel").entries()) {
    const refs = refsOf(c);
    const label = `#${i}, ${refs.length} reference(s), exponent ${c.exponent}`;

    it(`fits ${label}`, () => {
      const state = c.exponent === null ? fit(refs) : fit(refs, c.exponent);
      expect(state[0]).toBeCloseTo(c.state[0], 9);
      expect(state[1]).toBeCloseTo(c.state[1], 9);
    });

    it(`predicts from ${label}`, () => {
      const state = c.exponent === null ? fit(refs) : fit(refs, c.exponent);
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

describe("riegel refuses what the Python module refuses", () => {
  /* THE REFUSALS ARE THE HALF THE FIXTURE CANNOT PIN. The builder leaves an
   * unpriceable case OUT rather than recording the exception, because holding a
   * port to an identical message would be pinning prose. So the CONDITIONS are
   * asserted here, against the same numbers the Python guards use. */

  it("carries the published constants", () => {
    expect(DEFAULT_EXPONENT).toBe(1.06);
    expect(EXPONENT_BAND).toEqual([0.9, 1.3]);
    expect(MILE_METRES).toBe(1609.344);
  });

  it("pins A through a single reference at the default exponent", () => {
    const [a, k] = fit([[5000, 1087]]);
    expect(k).toBe(DEFAULT_EXPONENT);
    expect(a * Math.pow(5000, k)).toBeCloseTo(1087, 9);
  });

  it("refuses an exponent outside the band", () => {
    expect(() => fit([[5000, 1087]], 2.0)).toThrow(/outside/);
    // Two references seconds apart fit a wild exponent rather than a runner.
    expect(() =>
      fit([
        [1500, 288],
        [5000, 290],
      ]),
    ).toThrow(/outside/);
  });

  it("refuses an explicit exponent alongside a fit", () => {
    expect(() =>
      fit(
        [
          [1500, 288],
          [5000, 1087],
        ],
        1.06,
      ),
    ).toThrow(/contradicts/);
  });

  it("needs a reference at all, and two distinct distances to fit one", () => {
    expect(() => fit([])).toThrow(/at least one/);
    expect(() =>
      fit([
        [5000, 1087],
        [5000, 1090],
      ]),
    ).toThrow(/two distinct distances/);
  });

  it("refuses non-positive seconds or a non-positive duration", () => {
    expect(() => fit([[5000, 0]])).toThrow(/positive/);
    expect(() => paceForDuration(fit([[5000, 1087]]), 0)).toThrow(/positive/);
  });

  it("refuses a distance outside 100 m to 500 km", () => {
    const state = fit([[5000, 1087]]);
    expect(() => raceSeconds(state, 50)).toThrow(/out of range/);
    expect(() => raceSeconds(state, 600_000)).toThrow(/out of range/);
  });
});
