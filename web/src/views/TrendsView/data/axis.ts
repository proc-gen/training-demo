/* The x axis of a trend: one slot per date, labelled where a label fits.
 *
 * THREE THINGS THE CHART CANNOT DECIDE FOR ITSELF, in one call:
 *
 *   1. DENSIFY -- a slot for every date on the series' own cadence, so position
 *      means time. `LineChart` spaces points by index, which is correct only if
 *      the caller hands it one point per date. It did not: `trendPanels` emits
 *      a point per MEASUREMENT, so the six zero-run weeks of the 2026 layoff
 *      and the eight days sleep never recorded simply closed up, and every gap
 *      in the record was drawn as a straight line between its neighbours.
 *   2. RELABEL -- with the two-digit year when the drawn span crosses one.
 *   3. TICK -- which slots carry an x label, from `axisTicks`.
 *
 * THE AXIS INVENTS SLOTS, NEVER VALUES. A filled slot is `null`: a date nobody
 * measured is not a zero, and this repo has paid for that confusion more than
 * once. Where zero IS the measurement -- a fully elapsed week with no running
 * in it -- it comes from the record, which is why `trendPanels` widened its
 * filter rather than this module filling with `0`.
 */

import { shortDate, shortDateY } from "@/lib/data/format";
import { labelWidth } from "@/lib/ux/charts/data/scales";
import { dateFromIndex, dayIndex, yearOf } from "./dates";
import type { Cadence, TrendPoint } from "./panels";
import { axisTicks } from "./ticks";

/** A daily series over a decade is 3,650 slots; anything past this is a sign
 *  the cadence is wrong, and a runaway array would hang the render. */
const MAX_SLOTS = 4000;

const STEP: Record<Cadence, number> = { day: 1, week: 7 };

/** One slot per date between the first and last point, gaps carrying `null`.
 *
 * INTERIOR ONLY. The grid runs from the first point to the last and never out
 * to the window's own edges: a series that begins mid-window would otherwise be
 * squashed into a corner by months of blank axis, and the caption already
 * states the window at both ends.
 *
 * A POINT IS NEVER DROPPED TO FIT THE GRID. If any date misses the cadence --
 * an off-Monday weekly point, a cadence that does not match the data -- the
 * input comes back untouched. An uneven axis is a display defect; a missing
 * measurement is a lie.
 */
export function densify(points: TrendPoint[], cadence: Cadence): TrendPoint[] {
  if (points.length < 2) return points;
  const step = STEP[cadence] ?? 1;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = dayIndex(sorted[0].date);
  const last = dayIndex(sorted[sorted.length - 1].date);
  if (first === null || last === null) return points;

  const slots = (last - first) / step + 1;
  if (!Number.isInteger(slots) || slots > MAX_SLOTS) return points;

  const byDate = new Map<string, TrendPoint>();
  for (const p of sorted) {
    const i = dayIndex(p.date);
    if (i === null || (i - first) % step !== 0) return points;
    byDate.set(p.date, p);
  }

  const out: TrendPoint[] = [];
  for (let i = first; i <= last; i += step) {
    const date = dateFromIndex(i);
    out.push(byDate.get(date) ?? { date, label: shortDate(date), value: null });
  }
  return out;
}

/** Whether these dates span more than one calendar year.
 *
 * ALL THE LABELS OR NONE. A year printed on the two labels that happen to sit
 * in December reads as those dates being special rather than as the axis
 * crossing a boundary.
 */
export function crossesYears(dates: string[]): boolean {
  const years = new Set(dates.map(yearOf).filter((y): y is number => y !== null));
  return years.size > 1;
}

/** The slots a trend chart draws: densified, relabelled, and tick-flagged.
 *
 * `innerWidth` is the plot's own width in viewBox units -- the caller owns the
 * margins, so the caller works out how many labels fit and `axisTicks` decides
 * which dates get them.
 */
export function axisPoints({
  points,
  cadence,
  innerWidth,
}: {
  points: TrendPoint[];
  cadence: Cadence;
  innerWidth: number;
}): TrendPoint[] {
  const slots = densify(points, cadence);
  if (!slots.length) return slots;

  const dates = slots.map((p) => p.date);
  const year = crossesYears(dates);
  const labelled = slots.map((p) => ({
    ...p,
    label: year ? shortDateY(p.date) : shortDate(p.date),
  }));

  const budget = Math.max(
    2,
    Math.floor(innerWidth / labelWidth(labelled.map((p) => p.label))),
  );
  const ticks = new Set(axisTicks(dates, budget));
  return labelled.map((p) => (ticks.has(p.date) ? { ...p, tick: true } : p));
}
