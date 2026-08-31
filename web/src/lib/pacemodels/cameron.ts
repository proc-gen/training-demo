/* Cameron's race-equivalence formula. A PORT of
 * `scripts/pace-models/cameron.py`, and pure -- no payload, no dates, no IO.
 *
 * David Cameron's model (published to rec.running, 1998; one of the four
 * prognosis models Runalyze's docs list): two race times relate through an
 * endurance factor f evaluated at each distance,
 *
 *     t2 = (t1 / d1) * (f(d1) / f(d2)) * d2
 *     f(x) = 13.49681 - 0.000030363 x + 835.7114 / x^0.7905      (x in metres)
 *
 * The metre-form coefficients are the mile-form ones (13.49681, 0.048865,
 * 2.438936 over miles^0.7905) converted exactly. A CROSS-CHECK model here,
 * never the scored one -- see `danielsGilbert.ts` for the line this may not
 * cross and `riegel.ts` for why the port exists at all.
 *
 * State is the single `[distance_m, seconds]` reference.
 */

export const ENDURANCE: [number, number, number, number] = [
  13.49681, 0.000030363, 835.7114, 0.7905,
];

export const MILE_METRES = 1609.344;

/** Cameron's own validity edge, not this repo's convention: the linear term
 *  drives f negative past ~444 km, and predicted time stops rising well before
 *  that. 100 km keeps the marathon deep inside the monotone region; the other
 *  models carry the repo-wide 500 km bound because their curves stay sane. */
export const DOMAIN_METRES: [number, number] = [100, 100_000];

/** The same deterministic bracket-and-halve the Daniels solver uses, here over
 *  DISTANCE. 200 halvings are exact to double precision, which is what makes
 *  the answer identical bit for bit on both sides rather than merely close. */
const BISECTIONS = 200;

export type CameronState = [number, number];

function checkDistance(distanceM: number): void {
  const [lo, hi] = DOMAIN_METRES;
  if (!(distanceM >= lo && distanceM <= hi)) {
    throw new RangeError(`distance out of range for cameron: ${distanceM} m`);
  }
}

function f(metres: number): number {
  const [a, b, c, e] = ENDURANCE;
  return a - b * metres + c / Math.pow(metres, e);
}

/** The state is ONE reference performance, validated.
 *
 * Exactly one: Cameron's formula has no free parameter to fit, so a second
 * reference would be silently ignored -- refused instead.
 */
export function fit(
  references: ReadonlyArray<readonly [number, number]>,
): CameronState {
  if (references.length !== 1) {
    throw new RangeError(
      `cameron takes exactly one reference performance, got ${references.length}`,
    );
  }
  const [d, s] = references[0];
  checkDistance(d);
  if (!(s > 0)) throw new RangeError(`seconds must be positive, got ${s}`);
  return [d, s];
}

/** Predicted race seconds from the reference through the endurance factor. */
export function raceSeconds(state: CameronState, distanceM: number): number {
  const [d1, s1] = state;
  checkDistance(distanceM);
  return (s1 / d1) * (f(d1) / f(distanceM)) * distanceM;
}

/** sec/mi raceable for a duration.
 *
 * The formula predicts time from distance; the inversion is bisection over
 * distance, which is monotone inside the model's domain -- a longer race takes
 * longer -- so the root is unique.
 */
export function paceForDuration(
  state: CameronState,
  durationSeconds: number,
): number {
  if (!(durationSeconds > 0)) {
    throw new RangeError(`duration must be positive, got ${durationSeconds}`);
  }
  let lo = DOMAIN_METRES[0];
  let hi = DOMAIN_METRES[1];
  if (
    !(
      raceSeconds(state, lo) <= durationSeconds &&
      durationSeconds <= raceSeconds(state, hi)
    )
  ) {
    throw new RangeError(
      `duration ${durationSeconds} s resolves outside the ` +
        `${lo.toFixed(0)}-${hi.toFixed(0)} m distance range`,
    );
  }
  for (let i = 0; i < BISECTIONS; i++) {
    const mid = (lo + hi) / 2;
    if (raceSeconds(state, mid) < durationSeconds) lo = mid;
    else hi = mid;
  }
  const d = (lo + hi) / 2;
  return durationSeconds / (d / MILE_METRES);
}
