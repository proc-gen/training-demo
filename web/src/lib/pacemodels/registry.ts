/* Every pace model behind one interface. The port of
 * `scripts/pace-models/registry.py` plus `propose_chart.seed_state`.
 *
 * `daniels_gilbert` is FIRST and is the default everywhere: it is the model the
 * athlete grades against -- their own choice, the effective-VO2max method --
 * and the only one that can state a vVO2max, which is what the training bands
 * are percentages of. The other three are CROSS-CHECKS: an independent method's
 * opinion of the same anchor, reported beside it and never scored against.
 *
 * State is opaque to callers. `seedState` is the one dispatch point, so nothing
 * outside this file branches on which inputs a model requires.
 *
 * ORDER IS DISPLAY ORDER, and it is the constant `PaceRail.MODEL_ORDER` used to
 * be -- the record was written with `sort_keys`, so the component had to carry
 * its own. The record is gone and the order lives once, here, at its source.
 */

import * as cameron from "./cameron";
import * as criticalSpeed from "./criticalSpeed";
import * as danielsGilbert from "./danielsGilbert";
import * as riegel from "./riegel";

/** What a model needs to reach a state. */
export type Requires = "vo2max" | "references";

export type ModelName =
  | "daniels_gilbert"
  | "riegel"
  | "cameron"
  | "critical_speed";

/** The scored model first, cross-checks after. */
export const MODEL_NAMES: readonly ModelName[] = [
  "daniels_gilbert",
  "riegel",
  "cameron",
  "critical_speed",
];

/** How a model is titled in the rail's dropdown and its column heading.
 *
 * THE APP OWNS THIS NOW. It used to arrive as `label` on the published record,
 * on the `score_bucket` rule -- the page maps tokens to words it is GIVEN
 * rather than growing its own copy of a grader vocabulary. That rule is about
 * a GRADER's vocabulary; these models are the app's own arithmetic since the
 * port, so their names are too. `LABELS` in `propose_chart.py` is the Python
 * copy and `tests/test_pace_models.py` asserts the two agree.
 */
export const LABELS: Readonly<Record<ModelName, string>> = {
  daniels_gilbert: "Daniels-Gilbert (effective VO2max)",
  riegel: "Riegel power law",
  cameron: "Cameron",
  critical_speed: "Critical speed",
};

/** The distances a cross-check is seeded from, as Daniels-Gilbert predictions.
 *
 * Critical speed fits TWO parameters and so needs two efforts; the others fit
 * one and take a single 5000 m. `propose_chart.models_current` spells the same
 * split, and the seeded-from sentence below is built from this rather than
 * written out, so the two cannot describe different seeds.
 */
export const SEED_DISTANCES: Readonly<Record<ModelName, readonly number[]>> = {
  daniels_gilbert: [],
  riegel: [5000],
  cameron: [5000],
  critical_speed: [3000, 10000],
};

export type Model = {
  readonly requires: Requires;
  raceSeconds(state: never, distanceM: number): number;
  paceForDuration(state: never, durationSeconds: number): number;
};

/** One model's `[raceSeconds, paceForDuration]` bound to a state.
 *
 * Returned as closures rather than as a module plus an opaque state, because
 * TypeScript cannot express "this state belongs to this module" without a
 * generic that every caller would have to thread. The dispatch happens once,
 * here, which is what the Python registry's `build_state` achieves the other
 * way.
 */
export type Bound = {
  raceSeconds(distanceM: number): number;
  paceForDuration(durationSeconds: number): number;
};

/** A model bound to the state its seeds imply, or null when it cannot fit.
 *
 * NULL RATHER THAN A THROW, matching `seed_state`'s own `except ValueError:
 * return None`. A cross-check that cannot be seeded at some anchor is a column
 * the dropdown does not offer, not a page that fails to render.
 */
export function seedState(name: ModelName, vo2max: number): Bound | null {
  /* THE ANCHOR IS CHECKED FIRST, FOR EVERY MODEL, and that uniformity is the
   * point. A cross-check refuses a bad anchor at FIT time -- the seeded
   * prediction throws -- so without this line `daniels_gilbert` would be the
   * one model that bound happily and failed later, at whichever distance the
   * caller asked for. `registry.build_state` calls `check_vo2max` for the same
   * reason. 20-90 spans elite to sedentary; outside it the number is a typo,
   * and a typo'd anchor prices every projection wrong rather than failing. */
  try {
    danielsGilbert.checkVo2max(vo2max);
  } catch {
    return null;
  }
  if (name === "daniels_gilbert") {
    return {
      raceSeconds: (d) => danielsGilbert.raceSeconds(vo2max, d),
      paceForDuration: (s) => danielsGilbert.paceForDuration(vo2max, s),
    };
  }
  let refs: Array<readonly [number, number]>;
  try {
    refs = SEED_DISTANCES[name].map(
      (d) => [d, danielsGilbert.raceSeconds(vo2max, d)] as const,
    );
  } catch {
    return null;
  }
  try {
    if (name === "riegel") {
      const state = riegel.fit(refs);
      return {
        raceSeconds: (d) => riegel.raceSeconds(state, d),
        paceForDuration: (s) => riegel.paceForDuration(state, s),
      };
    }
    if (name === "cameron") {
      const state = cameron.fit(refs);
      return {
        raceSeconds: (d) => cameron.raceSeconds(state, d),
        paceForDuration: (s) => cameron.paceForDuration(state, s),
      };
    }
    const state = criticalSpeed.fit(refs);
    return {
      raceSeconds: (d) => criticalSpeed.raceSeconds(state, d),
      paceForDuration: (s) => criticalSpeed.paceForDuration(state, s),
    };
  } catch {
    return null;
  }
}

/** The sentence naming what a model was seeded from.
 *
 * Built from `SEED_DISTANCES` rather than written out, so it cannot describe a
 * seed the fit did not use. `propose_chart.models_current` composes the same
 * two strings.
 */
export function seededFrom(name: ModelName): string {
  if (name === "daniels_gilbert") return "the chart's own effective VO2max";
  const seeds = SEED_DISTANCES[name].map((d) => `${d} m`).join(" + ");
  return `the Daniels-Gilbert ${seeds} predictions at that VO2max`;
}
