/* Effective VO2max on any date, and the projected race times that follow.
 *
 * THE ATHLETE ASKED FOR THIS, 2026-08-29: *"when we add the daily effective
 * vo2max calculation, make sure that I can view the daily values in the graphs
 * for projected race times. projected training paces should still be locked to
 * what was calculated at the end of the previous week."*
 *
 * That sentence is the whole design, and it lands on a distinction the pace
 * charts already draw:
 *
 *   - `race_paces` is a PROJECTION -- what the model expects, at whatever
 *     fitness the athlete has today. Nothing is graded against a race time, so
 *     evaluating it daily costs nothing and gains a curve where there was a
 *     step function through 87 confirmed Sundays.
 *   - `bands` is a CRITERION -- what every continuous run and sub-T rep is
 *     scored against. A target has to be the number the GRADER used, so the
 *     target-paces panel stays weekly and stays on the confirmed chart. See
 *     `paceSeries.ts`, where that is asserted rather than merely intended.
 *
 * `shape()` IS PORTED AND THE ESTIMATOR IS NOT. Pricing one activity's VO2max
 * needs the heart-rate curve, the elevation setting and the correction factor,
 * and it stays in `scripts/pace-models/estimate_vo2max.py` whose output is
 * published per activity. What is here is the trailing distance-weighted MEAN
 * over those published numbers -- ten lines of arithmetic, and the same split
 * `effective_vo2max.shape()` already draws on the Python side.
 *
 * DISTANCE-WEIGHTED ACROSS ACTIVITIES, which is a deliberate divergence from
 * Runalyze -- they average each day and then the days flat. The athlete kept
 * ours (*"I do prefer underweighting the easy runs for our current
 * calculation"*), and `scripts/pace-models/model.json -> _shape_note` records
 * why. Do not "fix" it to match theirs.
 */

import type { Payload, Vo2maxRow } from "@/lib/data/payload";

import { addDays } from "./dates";
import { MILE_METRES, raceSeconds } from "@/lib/pacemodels/danielsGilbert";

/** One activity, reduced to what the window reads. */
export type Sample = { date: string; vo2max: number; distanceKm: number };

/** Effective VO2max on one date, with the activity count behind it. */
export type Shaped = { value: number; count: number };

/** One day of the fitness curve. */
export type CurvePoint = { date: string; vo2max: number; count: number };

/** The rows the window can use: both numbers present and positive.
 *
 * A row with no `distance_km` cannot be weighted and a row with no `vo2max` is
 * an activity the estimator DECLINED to price -- Runalyze's stored 0.00 reads
 * as null rather than as zero fitness, and ours does the same. Neither is a
 * zero to average in.
 */
export function samples(rows: readonly Vo2maxRow[] | undefined): Sample[] {
  const out: Sample[] = [];
  for (const r of rows ?? []) {
    const { date, vo2max: v, distance_km: km } = r;
    if (typeof date !== "string" || !date) continue;
    if (typeof v !== "number" || !isFinite(v)) continue;
    if (typeof km !== "number" || !isFinite(km) || km <= 0) continue;
    out.push({ date, vo2max: v, distanceKm: km });
  }
  // ISO dates compare lexically, so no parsing is needed to order them.
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/** The port of `effective_vo2max.shape()`.
 *
 * `samples` must be sorted by date -- `samples()` above guarantees it. Null
 * with nothing in the window, never a fallback: an empty window means the
 * athlete logged nothing for six weeks, which is a gap in the line rather than
 * a fitness of zero.
 *
 * THE WINDOW IS INCLUSIVE AT BOTH ENDS and is `windowDays` long counting the
 * as-of date itself, which is why the low edge is `windowDays - 1` back. Python
 * spells it the same way; an off-by-one here would shift every point by a day's
 * worth of training.
 */
export function shape(
  samples: readonly Sample[],
  asOf: string,
  windowDays: number,
): Shaped | null {
  const lo = addDays(asOf, -(windowDays - 1));
  let weighted = 0;
  let total = 0;
  let count = 0;
  for (const s of samples) {
    if (s.date < lo) continue;
    if (s.date > asOf) break;
    weighted += s.vo2max * s.distanceKm;
    total += s.distanceKm;
    count++;
  }
  return total > 0 ? { value: weighted / total, count } : null;
}

/** The athlete's configured window, or null.
 *
 * NO FALLBACK, DELIBERATELY. The model's own default is 30 days and this
 * athlete has set 42, because that is what their Runalyze account is
 * configured to -- the `trimp.hr_max` rule: a smoothing that does not match
 * the account describes a different athlete's setting. Substituting 30 for an
 * unstated value would draw a plausible curve nobody configured, which is
 * exactly the shape of the `hr.tempo` fallback this repo refuses. A null here
 * draws no curve, and no curve is a question rather than a wrong answer.
 */
export function windowDays(payload: Payload): number | null {
  const vo2max = (payload.thresholds as { vo2max?: unknown } | null | undefined)
    ?.vo2max as { shape_window_days?: unknown } | undefined;
  const days = vo2max?.shape_window_days;
  return typeof days === "number" && days > 0 ? days : null;
}

/** The fitness curve: one point per calendar day the series spans.
 *
 * EVERY day between the first and last activity, not one per activity. The
 * window is a state ON A DATE -- the same thing CTL is -- so a rest day has a
 * value, and it is usually a slightly different one from yesterday's because
 * the window's far edge moved.
 *
 * A day whose window holds nothing is OMITTED rather than carried forward. The
 * axis densifies interior gaps into null slots (`axisPoints`), so an absence
 * reads as an absence; carrying the last value forward would draw a flat line
 * through six weeks nobody ran and call it fitness.
 */
export function fitnessCurve(
  samples: readonly Sample[],
  window: number,
): CurvePoint[] {
  if (!samples.length) return [];
  const out: CurvePoint[] = [];
  const last = samples[samples.length - 1].date;
  for (let d = samples[0].date; d <= last; d = addDays(d, 1)) {
    const got = shape(samples, d, window);
    if (got) out.push({ date: d, vo2max: got.value, count: got.count });
  }
  return out;
}

/** Projected seconds for one distance at one day's fitness, or null.
 *
 * `raceSeconds` REFUSES a VO2max outside 20-90 and this swallows that refusal,
 * which is the one place in this module that does. The guard exists so a typo'd
 * anchor cannot price a whole chart; here the anchor is computed from published
 * measurements rather than typed, so an out-of-range value means the window
 * held something strange and the honest response is a gap in the line rather
 * than a blank page.
 */
export function projectedSeconds(vo2max: number, metres: number): number | null {
  try {
    return raceSeconds(vo2max, metres);
  } catch {
    return null;
  }
}

/** The same projection as seconds per mile. */
export function projectedSecPerMi(
  vo2max: number,
  metres: number,
): number | null {
  const seconds = projectedSeconds(vo2max, metres);
  return seconds === null ? null : seconds / (metres / MILE_METRES);
}
