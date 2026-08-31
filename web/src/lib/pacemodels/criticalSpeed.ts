/* The critical-speed model. A PORT of
 * `scripts/pace-models/critical_speed.py`, and pure -- no payload, no dates,
 * no IO.
 *
 * The two-parameter hyperbolic model of the exercise-physiology literature
 * (Monod & Scherrer 1965; Jones, Vanhatalo et al. on its running form): total
 * distance is linear in time,
 *
 *     d = CS * t + D'
 *
 * where CS (m/s) is the highest steadily sustainable speed and D' (metres) the
 * finite distance runnable above it. Fitted from two or more maximal efforts.
 *
 * A CROSS-CHECK model, never the scored one, and the physiology bounds its
 * honesty: the linear form is calibrated on ~2-30 minute efforts. Beyond that
 * it converges on CS itself and OVERPREDICTS long races (no marathon runs at
 * critical speed); below ~2 minutes the anaerobic term dominates and the fit is
 * an extrapolation. The divergence from Daniels-Gilbert at the ends is exactly
 * what a cross-check is for -- it is reported, not reconciled.
 *
 * State is the `[cs_m_per_s, d_prime_m]` pair.
 */

export const MILE_METRES = 1609.344;

export type CriticalSpeedState = [number, number];

function checkDistance(distanceM: number): void {
  if (!(distanceM >= 100 && distanceM <= 500_000)) {
    throw new RangeError(`distance out of range: ${distanceM} m`);
  }
}

/** `[CS, D']` by least squares on d against t.
 *
 * Two references solve exactly; more over-determine the line. Distinct times
 * are required -- two efforts of one duration carry no slope -- and a
 * non-positive CS or D' is refused rather than returned: both have physical
 * meaning, and a fit producing either is describing data the model cannot (a
 * longer race run FASTER than a shorter one, or two points so close the
 * intercept lands below zero).
 */
export function fit(
  references: ReadonlyArray<readonly [number, number]>,
): CriticalSpeedState {
  const refs: Array<readonly [number, number]> = [];
  for (const [d, s] of references) {
    checkDistance(d);
    if (!(s > 0)) throw new RangeError(`seconds must be positive, got ${s}`);
    refs.push([s, d] as const);
  }
  if (refs.length < 2) {
    throw new RangeError(
      "critical speed needs at least two reference performances to fit two " +
        "parameters",
    );
  }
  if (new Set(refs.map(([t]) => t)).size < 2) {
    throw new RangeError("fitting a slope needs two distinct durations");
  }
  const n = refs.length;
  const mt = refs.reduce((a, [t]) => a + t, 0) / n;
  const md = refs.reduce((a, [, d]) => a + d, 0) / n;
  let num = 0;
  let den = 0;
  for (const [t, d] of refs) {
    num += (t - mt) * (d - md);
    den += (t - mt) * (t - mt);
  }
  const cs = num / den;
  const dPrime = md - cs * mt;
  if (!(cs > 0)) {
    throw new RangeError(
      `fitted critical speed ${cs.toFixed(3)} m/s is not positive -- a ` +
        `longer effort covered less distance`,
    );
  }
  if (!(dPrime > 0)) {
    throw new RangeError(
      `fitted D' ${dPrime.toFixed(1)} m is not positive -- the references do ` +
        `not span the hyperbolic region`,
    );
  }
  return [cs, dPrime];
}

/** `t = (d - D') / CS`.
 *
 * A distance inside D' is anaerobic territory the model prices at zero aerobic
 * time, so it is refused rather than returned.
 */
export function raceSeconds(
  state: CriticalSpeedState,
  distanceM: number,
): number {
  const [cs, dPrime] = state;
  checkDistance(distanceM);
  if (distanceM <= dPrime) {
    throw new RangeError(
      `${distanceM} m is inside D' (${dPrime.toFixed(0)} m) -- below the ` +
        `model's aerobic range`,
    );
  }
  return (distanceM - dPrime) / cs;
}

/** sec/mi raceable for a duration: `v = CS + D'/t`, in closed form. */
export function paceForDuration(
  state: CriticalSpeedState,
  durationSeconds: number,
): number {
  const [cs, dPrime] = state;
  if (!(durationSeconds > 0)) {
    throw new RangeError(`duration must be positive, got ${durationSeconds}`);
  }
  return MILE_METRES / (cs + dPrime / durationSeconds);
}
