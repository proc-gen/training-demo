/* Chart scale arithmetic, pulled out of the drawing code.
 *
 * These decide where a mark lands. They were inline in the SVG builders, which
 * is how `niceTicks` shipped a bug that put a red rule across the legend --
 * nothing could reach them to check. The SVG emission stays untested (it is the
 * thin framework-coupled layer); everything that decides a coordinate is here.
 */

/** A value with its floating-point crumbs swept up.
 *
 * `0.1 + 0.2` is 0.30000000000000004, and a tick is a number a reader is meant
 * to read: unrounded, the y axis of an A:C chart prints thirteen decimal places
 * beside a two-decimal series. Twelve significant digits is far more precision
 * than any measurement here carries and far less than the artifact needs.
 */
const round12 = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(12)) : v);

/** The gap between ticks: 1, 2, 2.5 or 5 times a power of ten, at or above `raw`.
 *
 * ONE LADDER, TWO CALLERS. `niceTicks` builds a column axis up from zero and
 * `lineScale` snaps a line's domain outward to a multiple of this; both mean the
 * same thing by "a round number", and two ladders would eventually disagree
 * about what one is.
 */
const LADDER = [1, 2, 2.5, 5, 10];

const rungs = (raw: number) => {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return LADDER.map((m) => round12(m * mag));
};

export function niceStep(raw: number): number {
  if (!isFinite(raw) || raw <= 0) return 1;
  const up = rungs(raw);
  return up.filter((v) => v >= raw)[0] || up[up.length - 1];
}

/** The NEAREST rung of the same ladder, above or below.
 *
 * FOR A DOMAIN, WHERE `niceStep` IS FOR A CEILING. `niceTicks` must never step
 * below the data -- a bar past the top tick escapes the plot -- so it always
 * rounds up, and rounding up systematically UNDERSHOOTS the tick count: a
 * 57.7-mile series asking for five ticks wants a step of 11.5, gets 20, and is
 * drawn with three. A line's domain is snapped outward at both ends instead, so
 * a step below the ideal costs nothing and buys the reader the interior marks
 * this whole change is about.
 *
 * Nearest in RATIO, not in difference: the ladder is geometric, so 11.5 sits
 * closer to 10 than to 20 even though the gaps look equal on a page.
 */
export function niceStepNear(raw: number): number {
  if (!isFinite(raw) || raw <= 0) return 1;
  return rungs(raw).reduce((best, v) =>
    Math.abs(Math.log(v / raw)) < Math.abs(Math.log(best / raw)) ? v : best,
  );
}

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
  const step = niceStep(max / (count || 4));
  const out: number[] = [];
  for (let v = 0; v < max - step * 0.001; v += step) out.push(round12(v));
  out.push(round12(out.length ? out[out.length - 1] + step : step));
  return out;
}

export type Part = { value: number | null | undefined; color: string };
export type Column = {
  label: string;
  parts: Part[];
  ceiling?: number | null;
  /** Whether this slot carries an x-axis label.
   *
   * SET BY THE CALLER, because deciding it needs to know what the labels MEAN --
   * the Trends view puts them on calendar boundaries, which is a fact about
   * dates and none of a chart's business. When no column carries one the chart
   * falls back to `labelStride`, so every existing caller is unchanged. */
  tick?: boolean;
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

/** How many columns to skip between x labels, so they stop overlapping.
 *
 * A column chart of one week labels all seven and should. The Trends view plots
 * a column per DAY over a window the reader chooses, and thirty-one labels in
 * the space of seven is an unreadable smear — so a label is drawn every `stride`
 * columns once the band is narrower than a label needs.
 *
 * IT COUNTS BACK FROM THE LAST COLUMN, which is why the caller tests
 * `(count - 1 - i) % stride`. The newest day is the one a reader anchors on and
 * it must always carry its date; strides measured forward from column zero drop
 * it whenever the count is not a multiple of the stride.
 *
 * Returns 1 whenever there is room, so a chart that fits — every existing caller
 * — is drawn exactly as it was.
 */
export function labelStride(count: number, band: number, minWidth = 34): number {
  if (count <= 1 || band <= 0 || band >= minWidth) return 1;
  return Math.ceil(minWidth / band);
}

/** How wide the widest of these labels needs, in viewBox units.
 *
 * `.axis-label` is 11px, and an SVG font-size is in USER UNITS -- so a label's
 * footprint scales with the viewBox and can be estimated from it. 0.56em per
 * character is the average across digits and a slash; the 10 is the gap that
 * keeps two labels from touching.
 *
 * WHY IT IS NOT A CONSTANT. `8/17` and `10/1/25` differ by half again, and a
 * year-bearing axis thinned at the four-character width overlaps every label.
 */
export function labelWidth(labels: string[], px = 11): number {
  const longest = labels.reduce((a, s) => Math.max(a, s.length), 0);
  return longest ? longest * px * 0.56 + 10 : 34;
}

/** How many y ticks a plot this tall can carry.
 *
 * ONE EVERY ~55 UNITS. Two was the whole y axis until 2026-08-21 -- the data's
 * own min and max, which is a RANGE and not a scale: no interior value could be
 * read off a 320-unit plot. Capped at 6 so a tall chart does not turn into
 * ruled paper, floored at 2 so the 130-unit small-multiple box is unchanged.
 */
export function tickCount(innerHeight: number): number {
  if (!isFinite(innerHeight) || innerHeight <= 0) return 2;
  return Math.max(2, Math.min(6, Math.round(innerHeight / 55)));
}

/** The domain and the ticks a line chart plots over.
 *
 * BOTH BOUNDS ARE THEMSELVES TICKS. `lineDomain` padded 15% past the data and
 * drew its two rules at the unpadded ends, which put the bottom of the PLOT a
 * sixth of a chart below the bottom RULE -- so an area wash closed at the plot
 * floor hung below its own axis, which is exactly what the athlete saw on
 * 2026-08-21. Snapping outward to a whole multiple of `niceStep` makes the plot
 * floor and the lowest gridline the same line, and hands the reader round
 * numbers instead of `57.7 mi`.
 *
 * A flat series would divide by zero -- every point equal makes `hi - lo` zero
 * -- so it is widened by one first. ON A ZERO-ANCHORED SCALE IT WIDENS UPWARD
 * ONLY: dropping to -1 would reinstate the wash below the axis for the one
 * series most likely to be flat at zero.
 */
export function lineScale(
  values: number[],
  opts: { zero?: boolean; count?: number } = {},
): { lo: number; hi: number; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return { lo: 0, hi: 1, ticks: [0, 1] };

  const count = Math.max(2, Math.round(opts.count ?? 4));
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (opts.zero) lo = Math.min(0, lo);
  if (lo === hi) {
    hi += 1;
    if (!opts.zero || lo < 0) lo -= 1;
  }

  const step = niceStepNear((hi - lo) / count);
  const loT = round12(Math.floor(round12(lo / step)) * step);
  const hiT = round12(Math.ceil(round12(hi / step)) * step);

  const ticks: number[] = [];
  for (let i = 0; i <= 200; i += 1) {
    const t = round12(loT + i * step);
    ticks.push(t);
    if (t >= hiT) break;
  }
  return { lo: loT, hi: ticks[ticks.length - 1], ticks };
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
