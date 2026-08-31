/* Riegel's power law. A PORT of `scripts/pace-models/riegel.py`, and pure --
 * no payload, no dates, no IO.
 *
 * Riegel, *Athletic Records and Human Endurance* (American Scientist, 1981):
 * race time scales as a power of distance, `t = A * d^k`, with k ~ 1.06 for
 * distance runners. Implemented from the published paper on the Python side
 * and ported here; a CROSS-CHECK model, never the scored one -- the athlete
 * grades against the effective-VO2max model, and this exists to show where an
 * independent method diverges from it.
 *
 * WHY THE PORT EXISTS. `published/pace-models-current.json` used to carry every
 * model's race table, recomputed by `propose_chart.py` on every publish and
 * rewritten in full each time a chart moved the anchor. The tables are a pure
 * function of that one anchor, so the app computes them and the record is gone.
 * The rule this repo actually holds is that a second implementation must be
 * PINNED, which `paceModelReference.json` and `riegel.test.ts` do.
 *
 * THE LINE THIS MAY NOT CROSS, the same one `danielsGilbert.ts` states: what
 * this computes is a PROJECTION, shown under this model's own name in the
 * rail's Current column. It must never state a number a session was graded
 * against -- those come from the confirmed chart in `published/`.
 *
 * State is the `[A, k]` pair. Every function is arithmetic over its arguments.
 */

/** Riegel's published endurance exponent for runners, pinned by value in the
 *  test against the Python module's own. */
export const DEFAULT_EXPONENT = 1.06;

/** Fitted exponents outside this band describe something other than distance
 *  running -- a data-entry error, two references seconds apart, a sprint mixed
 *  with a marathon. Refusing beats a chart quietly priced from k = 2. */
export const EXPONENT_BAND: [number, number] = [0.9, 1.3];

export const MILE_METRES = 1609.344;

export type RiegelState = [number, number];

function checkDistance(distanceM: number): void {
  if (!(distanceM >= 100 && distanceM <= 500_000)) {
    throw new RangeError(`distance out of range: ${distanceM} m`);
  }
}

function checkExponent(k: number): void {
  const [lo, hi] = EXPONENT_BAND;
  if (!(k >= lo && k <= hi)) {
    throw new RangeError(
      `endurance exponent ${k.toFixed(4)} outside [${lo}, ${hi}] -- the ` +
        `references do not describe distance running`,
    );
  }
}

/** `[A, k]` from performances. Each reference is `[distance_m, seconds]`.
 *
 * One reference: A is pinned through it at `exponent` (default 1.06). Two or
 * more: both parameters come from least squares on `ln t` against `ln d` --
 * the athlete's own endurance exponent -- and passing `exponent` alongside them
 * is REFUSED, because the caller would be stating a value the fit is about to
 * measure.
 */
export function fit(
  references: ReadonlyArray<readonly [number, number]>,
  exponent?: number,
): RiegelState {
  const refs = references.map(([d, s]) => {
    checkDistance(d);
    if (!(s > 0)) throw new RangeError(`seconds must be positive, got ${s}`);
    return [d, s] as const;
  });
  if (!refs.length) {
    throw new RangeError("riegel needs at least one reference performance");
  }
  if (refs.length === 1) {
    const k = exponent === undefined ? DEFAULT_EXPONENT : exponent;
    checkExponent(k);
    const [d, s] = refs[0];
    return [s / Math.pow(d, k), k];
  }
  if (exponent !== undefined) {
    throw new RangeError(
      "an explicit exponent contradicts fitting one from several references " +
        "-- pass one reference, or none of the exponent",
    );
  }
  if (new Set(refs.map(([d]) => d)).size < 2) {
    throw new RangeError("fitting an exponent needs two distinct distances");
  }
  const xs = refs.map(([d]) => Math.log(d));
  const ys = refs.map(([, s]) => Math.log(s));
  const n = refs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  const k = num / den;
  checkExponent(k);
  return [Math.exp(my - k * mx), k];
}

/** Predicted race seconds: `A * d^k`. Unrounded. */
export function raceSeconds(state: RiegelState, distanceM: number): number {
  const [a, k] = state;
  checkDistance(distanceM);
  return a * Math.pow(distanceM, k);
}

/** sec/mi raceable for a duration. The power law inverts in closed form:
 *  `d = (t / A)^(1/k)`. */
export function paceForDuration(
  state: RiegelState,
  durationSeconds: number,
): number {
  const [a, k] = state;
  if (!(durationSeconds > 0)) {
    throw new RangeError(`duration must be positive, got ${durationSeconds}`);
  }
  const d = Math.pow(durationSeconds / a, 1.0 / k);
  checkDistance(d);
  return durationSeconds / (d / MILE_METRES);
}
