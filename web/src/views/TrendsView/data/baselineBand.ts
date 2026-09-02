/* The trailing baseline band under the HRV and resting-HR points.
 *
 * THE ATHLETE ASKED FOR THIS, 2026-09-01: show the wellness measurements as
 * unconnected points, with the faded area being the trailing average plus or
 * minus 10% of its value at that point in time -- and if grading uses a
 * different timeframe than the 30 days first suggested, use the grading
 * timeframe instead. It does, so this module uses it.
 */

import { addDays } from "./dates";

/** The grader's own timeframe, and NOT `model.json.hrv_baseline_days` (28) --
 * that constant is only the no-snapshot FALLBACK. Every weekly
 * `snapshots/load-baselines/<week-end>.json` computes `hrv_baseline` as the
 * trailing 7-day mean of overnight HRV, verified byte-for-byte against
 * Runalyze's `hrvBaseline` / Garmin's `7d Avg` (the 470/7 case in
 * `memory-bank/progress.md`). Resting HR's rise flag reads the same 7-day week
 * mean. Do not "fix" this to 28.
 */
export const BASELINE_WINDOW_DAYS = 7;

/** The half-width of the band, as a fraction of the mean.
 *
 * The LOWER edge is the grading floor itself: the readiness check passes at
 * `value >= hrv_baseline_floor_pct * hrv_baseline`, and that constant is 0.9 --
 * pinned against `published/load-model.json` by the test beside this file. The
 * upper edge mirrors it for display; nothing scores against it.
 */
export const BASELINE_TOLERANCE = 0.1;

/** A band around one date's trailing mean. `lo` and `hi` are what the chart
 *  draws and the tooltip states -- the mean itself is deliberately not
 *  returned, the deleted-midpoint rule: what a reader wants off a band is
 *  where it stops. */
export type BaselineBand = { lo: number; hi: number };

/** The band for every measured date, keyed by date.
 *
 * For each measured day `d` the mean is the UNWEIGHTED mean over whatever
 * measured values fall in the calendar window `[d-6, d]`, both ends inclusive
 * -- the same tolerant shape as the grader's fallback (`grade_load.readiness`
 * averages whatever non-null days the window holds). The day itself is always
 * in its own window, so every measured day gets a band.
 *
 * Callers hand over the FULL measured series, never a windowed slice: the
 * Trends window is applied later, and a band computed inside it would lose its
 * trailing history at the window's left edge.
 */
export function baselineBands(
  points: readonly { date: string; value: number }[],
): Map<string, BaselineBand> {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const out = new Map<string, BaselineBand>();
  for (const p of points) {
    let sum = 0;
    let count = 0;
    for (let back = 0; back < BASELINE_WINDOW_DAYS; back++) {
      const v = byDate.get(addDays(p.date, -back));
      if (v !== undefined) {
        sum += v;
        count++;
      }
    }
    const mean = sum / count; // count >= 1: the day itself is in the map
    out.set(p.date, {
      lo: (1 - BASELINE_TOLERANCE) * mean,
      hi: (1 + BASELINE_TOLERANCE) * mean,
    });
  }
  return out;
}
