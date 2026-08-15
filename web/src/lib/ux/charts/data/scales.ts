/* Chart scale arithmetic, pulled out of the drawing code.
 *
 * These decide where a mark lands. They were inline in the SVG builders, which
 * is how `niceTicks` shipped a bug that put a red rule across the legend --
 * nothing could reach them to check. The SVG emission stays untested (it is the
 * thin framework-coupled layer); everything that decides a coordinate is here.
 */

/** Axis ticks from 0, the last one at or ABOVE `max`.
 *
 * THE BUG THIS MODULE IS TESTED FOR. It used to return the last tick at or
 * BELOW the maximum, and `columnScale` takes the top tick as the scale's
 * ceiling -- so any bar between the last tick and `max` was drawn at a negative
 * y and escaped the plot. A 34,000 SE day ceiling against a 30,000 top tick
 * painted a red rule straight across the legend. Bars may never overflow their
 * axis.
 *
 * It sat in `format.ts` for as long as that file was the only tested module on
 * the front end. `columnScale` below is its only caller, so it lives here now.
 */
export function niceTicks(max: number, count?: number): number[] {
  if (!max || max <= 0) return [0];
  const raw = max / (count || 4);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).filter((v) => v >= raw)[0] ||
    10 * mag;
  const out: number[] = [];
  for (let v = 0; v < max - step * 0.001; v += step) out.push(v);
  out.push(out.length ? out[out.length - 1] + step : step);
  return out;
}

export type Part = { value: number | null | undefined; color: string };
export type Column = {
  label: string;
  parts: Part[];
  ceiling?: number | null;
};

/** The top of a column chart's y-scale.
 *
 * A ceiling counts toward the maximum ONLY on a column that has a bar. An empty
 * day's ceiling is never drawn, so letting it stretch the scale would squash
 * the whole week for one uncovered rest day.
 */
export function columnMax(columns: Column[]): number {
  let max = 0;
  for (const c of columns) {
    const total = c.parts.reduce((a, p) => a + (p.value || 0), 0);
    max = Math.max(max, total, total > 0 ? c.ceiling || 0 : 0);
  }
  return max;
}

/** Ticks and the scale ceiling for a column chart.
 *
 * `top` is the LAST tick, which is at or above the data maximum -- that is the
 * invariant `niceTicks` exists to hold, and taking anything else as the ceiling
 * is what let bars draw at a negative y and escape the plot.
 */
export function columnScale(columns: Column[], count = 4) {
  const max = columnMax(columns);
  const ticks = niceTicks(max, count);
  const top = ticks[ticks.length - 1] || 1;
  return { max, ticks, top };
}

/** The [lo, hi] a line chart plots over, padded by 15% each way.
 *
 * A flat series would otherwise divide by zero: every point equal makes
 * `hi - lo` zero, so the range is widened by one before padding.
 */
export function lineDomain(
  values: number[],
  opts: { zero?: boolean } = {},
): { lo: number; hi: number; pad: number } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (opts.zero) lo = Math.min(0, lo);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.15;
  return { lo: lo - pad, hi: hi + pad, pad };
}

/** The [lo, hi] for the rep-pace plot, which must contain the whole band.
 *
 * Padding has a FLOOR of 4 sec/mi: eight reps run within two seconds of each
 * other would otherwise get a domain a couple of seconds wide, and the plot
 * would read as wild scatter when the session was in fact metronomic.
 */
export function repPaceDomain(
  paces: number[],
  band: [number, number] | null,
  /** Per-rep bands, when a set has more than one. EVERY one must fit inside the
   *  domain for the same reason `band` must: a region drawn outside it renders
   *  at a y beyond the plot and takes the mark it explains with it. */
  bands: [number, number][] = [],
): { lo: number; hi: number; pad: number } {
  let lo = Math.min(...paces);
  let hi = Math.max(...paces);
  for (const b of [...(band ? [band] : []), ...bands]) {
    lo = Math.min(lo, b[0]);
    hi = Math.max(hi, b[1]);
  }
  const pad = Math.max(4, (hi - lo) * 0.25);
  // `pad` is returned because the gridlines go at the UNPADDED ends -- the two
  // rules label the real extent of the data, not the padding around it.
  return { lo: lo - pad, hi: hi + pad, pad };
}

/** The [lo, hi] for the rep/lap HEART-RATE plot.
 *
 * IT MUST CONTAIN EVERY CEILING, not just the data. A ceiling drawn outside the
 * domain is `niceTicks`' escaped-bar bug wearing a different hat -- the rule
 * lands at a negative y, draws across whatever sits above the chart, and the one
 * mark a reader needs in order to judge the session is the mark that is missing.
 * A session run well under its ceiling is exactly the case that triggers it, so
 * it would fire on the best week rather than the worst.
 *
 * Y IS UPRIGHT here, unlike `repPaceDomain`: a higher heart rate is a higher
 * number and belongs higher up. That difference is most of why this is a
 * separate chart rather than a mode flag on the pace one.
 *
 * The pad floor is 4 BPM, mirroring the 4 sec/mi floor above and for the same
 * reason: twelve reps within two beats of each other would otherwise get a
 * two-beat domain and read as wild scatter.
 */
export function repHrDomain(
  values: number[],
  ceilings: number[] = [],
): { lo: number; hi: number; pad: number } {
  const all = [...values, ...ceilings].filter((v) => Number.isFinite(v));
  if (!all.length) return { lo: 0, hi: 1, pad: 0 };
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = Math.max(4, (hi - lo) * 0.15);
  return { lo: lo - pad, hi: hi + pad, pad };
}

/** Evenly spaced values across a domain, for gridlines that give it scale.
 *
 * NOT `niceTicks`: that one starts at zero and is for a column chart's axis. A
 * rep plot's domain is a narrow window a long way from zero -- 140 to 170 bpm --
 * and zero-anchored ticks would put every line off the bottom of it.
 *
 * WHY IT EXISTS: both rep charts drew only their extremes, so a reader could see
 * that a mark was between two numbers and nothing more. Two labels is a range;
 * it is not a scale, and it is not enough to judge how far a rep sat from the
 * one criterion that mattered.
 *
 * `count` is the number of INTERIOR lines. Values are rounded to whole units,
 * then de-duplicated: a narrow domain would otherwise print the same number
 * twice and draw two lines a pixel apart.
 */
export function gridValues(lo: number, hi: number, count = 3): number[] {
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return [];
  const out: number[] = [];
  for (let i = 1; i <= count; i += 1) {
    out.push(Math.round(lo + ((hi - lo) * i) / (count + 1)));
  }
  return [...new Set(out)];
}

/** Whether a rep landed inside its prescribed band.
 *
 * No band means UNJUDGED, which reads as in-band here because the caller paints
 * the "outside it" colour only on a definite miss -- a missing pace chart must
 * not turn every rep red.
 */
export function inBand(pace: number, band: [number, number] | null): boolean {
  if (!band) return true;
  return pace >= band[0] && pace <= band[1];
}
