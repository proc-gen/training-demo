/* Every registered model's race table at one anchor. The port of
 * `propose_chart.race_paces` and `propose_chart.models_current`.
 *
 * WHAT THIS REPLACED. `published/pace-models-current.json` carried exactly this
 * object, recomputed by a `propose_chart.py` subprocess on every publish and
 * rewritten whole -- 194 lines -- each time a confirmed chart moved the anchor.
 * It is a pure function of that one number, so the app computes it and the
 * record is gone, along with the subprocess.
 *
 * NO `display` STRINGS. `RacePaceTable.raceText` reconstructs them from the
 * endpoints, which is the rule `project_chart` already applied to the charts
 * themselves: a display string is a rendering of the numbers beside it, and the
 * one place a renderer lives is the component. `basis` goes with them, being
 * prose. The Python still emits both, because `--models-current` is the
 * conversation-side cross-check and a terminal has no renderer.
 *
 * THE LINE THIS MAY NOT CROSS. A projection, shown under the model's own name.
 * Never a number a session was graded against.
 */

import { RACE_DISTANCES, TEMPO_DURATIONS_SECONDS } from "./constants";
import { checkVo2max } from "./danielsGilbert";
import {
  LABELS,
  MODEL_NAMES,
  seedState,
  seededFrom,
  type ModelName,
} from "./registry";

/** Round a TARGET to a whole second, halves AWAY FROM ZERO.
 *
 * `pacelib.round_target`, and the 2026-08-13 rule: a target is a time somebody
 * can run to, so the exact value rounds -- never a band edge, and never
 * banker's rounding, whose round-half-to-even would turn one target in a
 * thousand into a different second than the athlete's own arithmetic.
 *
 * THE SIX-DECIMAL PRE-ROUND IS NOT DECORATION. Without it a sixth-decimal float
 * artefact decides a whole second: `37.4999996` is a 37.5 the pace arithmetic
 * failed to land on exactly, and unrounded it floors to 37 -- a second out,
 * which on a 200 m rep is the entire tolerance again.
 *
 * `floor(x + 0.5)` IS WRITTEN OUT rather than `Math.round`, which takes halves
 * toward +Infinity and so disagrees on every negative. None occur here, and an
 * expression that agrees only on the inputs seen is not the same expression.
 *
 * ONE HONEST DIFFERENCE, stated rather than glossed: the pre-round is
 * `toFixed(6)`, which takes a 7th-decimal half away from zero, where Python's
 * `round(x, 6)` is banker's and takes it to even. The two can only differ on a
 * value that is EXACTLY a half at the seventh decimal, which the pace models --
 * exponentials, a quadratic root and a 200-step bisection -- do not produce.
 * `paceModelReference.json` pins the boundaries either way.
 */
export function roundTarget(x: number): number {
  return Math.floor(Number(x.toFixed(6)) + 0.5);
}

/** One race entry: what the model predicts, in seconds and per mile. */
export type ModelRacePace = {
  seconds?: number;
  sec_per_mi?: number;
  fast_sec_per_mi?: number;
  slow_sec_per_mi?: number;
};

export type ModelTable = {
  label: string;
  seeded_from: string;
  race_paces: Record<string, ModelRacePace>;
};

/** `sec_per_mi` COMES FROM THE EXACT SECONDS, not the rounded ones, matching
 *  the committed charts' own `_rounding_note`. Rounding twice would move a
 *  handful of paces by a second against every chart on disk. */
function racePaces(
  bound: NonNullable<ReturnType<typeof seedState>>,
): Record<string, ModelRacePace> {
  const out: Record<string, ModelRacePace> = {};
  for (const [key, metres] of Object.entries(RACE_DISTANCES)) {
    const exact = bound.raceSeconds(metres);
    out[key] = {
      seconds: roundTarget(exact),
      sec_per_mi: roundTarget(exact / (metres / 1609.344)),
    };
  }
  const [fastSeconds, slowSeconds] = TEMPO_DURATIONS_SECONDS;
  out.tempo = {
    fast_sec_per_mi: roundTarget(bound.paceForDuration(fastSeconds)),
    slow_sec_per_mi: roundTarget(bound.paceForDuration(slowSeconds)),
  };
  return out;
}

/** Every model's race table at an effective VO2max, or null when there is none.
 *
 * NULL FOR AN ABSENT OR OUT-OF-RANGE ANCHOR, which is the same nothing the
 * published record used to spell: no chart on disk means no anchor means no
 * dropdown. `checkVo2max` is the 20-90 band -- outside it the number is a typo,
 * and a typo'd anchor does not fail downstream, it prices every projection
 * wrong.
 *
 * A model that cannot be seeded is OMITTED rather than emitted empty; the rail
 * offers the ones that resolved, which is what `seed_state` returning None
 * already meant.
 */
export function modelsAt(vo2max: unknown): {
  effective_vo2max: number;
  models: Record<string, ModelTable>;
} | null {
  if (typeof vo2max !== "number" || !isFinite(vo2max)) return null;
  try {
    checkVo2max(vo2max);
  } catch {
    return null;
  }
  const models: Record<string, ModelTable> = {};
  for (const name of MODEL_NAMES) {
    const bound = seedState(name as ModelName, vo2max);
    if (!bound) continue;
    try {
      models[name] = {
        label: LABELS[name as ModelName],
        seeded_from: seededFrom(name as ModelName),
        race_paces: racePaces(bound),
      };
    } catch {
      // A model whose table cannot be priced at this anchor is a column the
      // dropdown does not offer. The same refusal `seedState` makes one step
      // earlier, for a failure that only shows up at a distance.
      continue;
    }
  }
  return Object.keys(models).length
    ? { effective_vo2max: vo2max, models }
    : null;
}
