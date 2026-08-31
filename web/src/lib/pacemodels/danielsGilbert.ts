/* The Daniels-Gilbert oxygen-power model. A PORT of
 * `scripts/pace-models/daniels_gilbert.py`, and pure -- no payload, no dates,
 * no IO.
 *
 * WHY A SECOND IMPLEMENTATION EXISTS AT ALL, given this repo's standing rule
 * against them. The rule -- stated five different ways, from `format.ts`'s
 * header to the `score_bucket` ruling -- forbids an UNPINNED second
 * implementation, not a second implementation: `repository.ts` is a port of
 * `unpublish()`, `slices.defaultWeekKey` a port of `defaultWeek.ts`,
 * `paceRows.chartVo2max` a port of `pacelib.chart_vo2max`, and each is held to
 * its original by a test. What makes THIS port safe is the same thing:
 *
 *   `web/src/test/paceModelReference.json` is generated from the Python module
 *   and `danielsGilbert.test.ts` asserts every case to 1e-9. The fixture is
 *   the `fitness-reference.json` / `vo2max-reference.json` shape, so it runs
 *   with no `raw/` and on any checkout.
 *
 * WHY IT IS WORTH PORTING. The athlete asked to see projected race times per
 * DAY. A daily effective VO2max is a windowed mean and is arithmetic; turning
 * one into a race time is THIS model, and it has to run wherever the page runs
 * -- which for the static export is a browser with no server behind it. The
 * alternative was Python emitting a daily race table, which is ~600 dates x 7
 * distances of published rows to avoid ~120 lines of arithmetic.
 *
 * IT MOVED HERE FROM `views/TrendsView/data/` ON 2026-08-30, when the paces
 * rail's model dropdown became the second consumer -- the proximity rule, and
 * the three CROSS-CHECK models came with it. `lib/pacemodels/` rather than
 * `lib/data/` because `structure.test.ts` fails a `lib/data/` module with
 * fewer than two importers, and `riegel.ts` has exactly one; a plugin
 * directory is what `lib/ux` and `lib/run` already are.
 *
 * THE LINE THIS MAY NOT CROSS. What this computes is a PROJECTION and is drawn
 * on the race-times panel only. It must never state a number a session was
 * graded against: those come from the confirmed chart in `published/`, which is
 * what the grader read. Seven of the 87 committed charts were TRANSCRIBED from
 * Runalyze's calculator and do not reproduce from their own anchor at all --
 * the record and the model genuinely disagree there, and the record wins.
 */

/** The five published coefficients, pinned by value in `danielsGilbert.test.ts`
 *  against the Python module's own -- a typo in one moves every projection by
 *  a few percent while leaving the curve's shape intact, which is the kind of
 *  wrong nobody notices by looking. */
const COST_QUADRATIC = 0.000104;
const COST_LINEAR = 0.182258;
const COST_INTERCEPT = -4.6;
const FRAC_FLOOR = 0.8;
const FRAC_SLOW: [number, number] = [0.1894393, 0.012778];
const FRAC_FAST: [number, number] = [0.2989558, 0.1932605];

export const MILE_METRES = 1609.344;

/* The solver's bracket in minutes, and the halving count. Both are the Python
   module's, and the count is what makes the answer DETERMINISTIC rather than
   merely close: 200 halvings land within 1e-57 minutes, so the same inputs
   give the same bits here and there. */
const BRACKET_MINUTES: [number, number] = [0.2, 3000.0];
const BISECTIONS = 200;

/** ml/kg/min demanded by running at a velocity in m/min. */
export function oxygenCost(velocityMPerMin: number): number {
  const v = velocityMPerMin;
  if (!(v > 0)) throw new RangeError(`velocity must be positive, got ${v}`);
  return COST_INTERCEPT + COST_LINEAR * v + COST_QUADRATIC * v * v;
}

/** The share of VO2max a runner can hold for a duration in minutes.
 *
 * Strictly decreasing: ~1.19 at two minutes, 1.0 near eleven -- the velocity at
 * VO2max is roughly an eleven-minute race -- and asymptotic to 0.8.
 */
export function sustainableFraction(minutes: number): number {
  if (!(minutes > 0)) {
    throw new RangeError(`duration must be positive, got ${minutes}`);
  }
  return (
    FRAC_FLOOR +
    FRAC_SLOW[0] * Math.exp(-FRAC_SLOW[1] * minutes) +
    FRAC_FAST[0] * Math.exp(-FRAC_FAST[1] * minutes)
  );
}

/** m/min whose oxygen cost is `vo2` -- the cost curve's positive root. */
export function velocityAt(vo2: number): number {
  if (!(vo2 > 0)) throw new RangeError(`oxygen cost must be positive, got ${vo2}`);
  const a = COST_QUADRATIC;
  const b = COST_LINEAR;
  const c = COST_INTERCEPT - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** 20-90 spans elite to sedentary. Outside it the number is a typo, and a
 *  typo'd VO2max does not fail downstream -- it prices every projection wrong. */
export function checkVo2max(vo2max: number): void {
  if (!Number.isFinite(vo2max) || vo2max < 20 || vo2max > 90) {
    throw new RangeError(`effective VO2max out of range: ${vo2max}`);
  }
}

/** Predicted race seconds for a distance at an effective VO2max.
 *
 * The t where supply meets cost. Cost falls as t grows while supply falls more
 * gently, so their difference crosses zero exactly once inside the bracket --
 * bisection cannot miss it and cannot return a second root.
 *
 * Unrounded. Display rounding belongs to whoever formats the number.
 */
export function raceSeconds(vo2max: number, distanceM: number): number {
  checkVo2max(vo2max);
  if (!(distanceM >= 100 && distanceM <= 500_000)) {
    throw new RangeError(`distance out of range: ${distanceM} m`);
  }
  let [lo, hi] = BRACKET_MINUTES;
  const surplus = (t: number) =>
    vo2max * sustainableFraction(t) - oxygenCost(distanceM / t);

  if (surplus(lo) >= 0) {
    throw new RangeError(
      `distance ${distanceM} m resolves faster than the ${lo}-minute bracket ` +
        `at VO2max ${vo2max} -- not a running prediction`,
    );
  }
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (surplus(mid) < 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60.0;
}

/** sec/mi a runner can race for a duration -- the calculator's other mode, and
 *  what prices the tempo range. No iteration: the duration fixes F(t) and the
 *  cost curve inverts in closed form. */
export function paceForDuration(vo2max: number, durationSeconds: number): number {
  checkVo2max(vo2max);
  if (!(durationSeconds > 0)) {
    throw new RangeError(`duration must be positive, got ${durationSeconds}`);
  }
  const v = velocityAt(vo2max * sustainableFraction(durationSeconds / 60.0));
  return (MILE_METRES / v) * 60.0;
}

/** Pace at 100% of VO2max -- what every training band is a percentage of. */
export function vvo2maxSecPerMi(vo2max: number): number {
  checkVo2max(vo2max);
  return (MILE_METRES / velocityAt(vo2max)) * 60.0;
}
