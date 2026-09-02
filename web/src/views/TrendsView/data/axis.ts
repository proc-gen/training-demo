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
import { type Period, periodOrdinal, periodStartOf } from "./periods";
import { axisTicks } from "./ticks";

/** A daily series over a decade is 3,650 slots; anything past this is a sign
 *  the cadence is wrong, and a runaway array would hang the render. */
const MAX_SLOTS = 4000;

/** The FIXED-STEP cadences. `month` and `year` are deliberately absent: a
 *  month is 28–31 days, so no constant step can walk one, and `densify`
 *  branches to the calendar walk below instead. */
const STEP: Partial<Record<Cadence, number>> = { day: 1, week: 7, fortnight: 14 };

/** The calendar cadences map onto `periods.ts`' own buckets, so the axis and
 *  the aggregation cannot disagree about where a month starts. */
const CALENDAR: Partial<Record<Cadence, Period>> = {
  month: "monthly",
  year: "yearly",
};

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
  const calendar = CALENDAR[cadence];
  if (calendar) return densifyCalendar(points, calendar);
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

/** The calendar-cadence half of `densify`: one slot per month or year.
 *
 * Slots are walked on the PERIOD ORDINAL rather than a day step, because the
 * periods are not fixed-length in days. Every point must sit at its period's
 * canonical START — `boundarySeries` is the only producer and plots buckets at
 * their starts — and a misaligned input comes back untouched, the same refusal
 * the fixed-step walk makes: an uneven axis is a display defect, a dropped
 * measurement is a lie.
 */
function densifyCalendar(points: TrendPoint[], period: Period): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = periodOrdinal(sorted[0].date, period);
  const last = periodOrdinal(sorted[sorted.length - 1].date, period);
  if (first === null || last === null) return points;
  if (last - first + 1 > MAX_SLOTS) return points;

  const byDate = new Map<string, TrendPoint>();
  for (const p of sorted) {
    const ord = periodOrdinal(p.date, period);
    if (ord === null || periodStartOf(ord, period) !== p.date) return points;
    byDate.set(p.date, p);
  }

  const out: TrendPoint[] = [];
  for (let ord = first; ord <= last; ord++) {
    const date = periodStartOf(ord, period);
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

/** Where a date sits on the drawn grid, as a FRACTIONAL slot index.
 *
 * THE ONE PLACE "on the date they were run" IS WRITTEN DOWN. The pace panels are
 * weekly and their slots are the Sundays a chart closes on, so a workout run on
 * a Tuesday has no slot of its own -- and never will, because the athlete runs
 * quality on Tuesday, Friday and Thursday and never on the chart's own day.
 * `2026-08-18` against slots seven days apart returns `3 + 2/7`, which
 * `MultiLineChart` turns into an x between the 8/16 and 8/23 gridlines.
 *
 * The consequence, stated rather than hidden: the band drawn UNDER that mark is
 * the straight line between two weekly charts, not the flat band that graded the
 * session. Consecutive charts move 1-3 s/mi, so that is under a second per mile
 * -- the price of putting the mark on its real date, which is what was asked for.
 *
 * **IT REFUSES ON AN UNEVEN GRID.** `densify` hands its input back untouched when
 * any date misses the cadence, and a linear date -> index map over slots that are
 * not evenly spaced would place every mark wrong while looking perfectly
 * plausible. The check is one subtraction: `last - first` must be exactly
 * `(n - 1) * step`.
 *
 * Null outside `[0, n - 1]` too. A window that clipped the week a workout sits in
 * has no pair of slots to place it between, and extrapolating past the last slot
 * would draw a mark outside the plot.
 */
export function slotAt(
  date: string,
  slots: { date: string }[],
  cadence: Cadence,
): number | null {
  if (slots.length < 2) return null;
  /* REFUSED on the calendar cadences: their slots are not evenly spaced in
     days, so the linear map below would place every mark wrong while looking
     plausible — the same reason an uneven grid is refused. No producer places
     marks on a month or year axis (the three aggregable panels carry none),
     and the refusal is the existing "no pair of slots" behaviour. */
  if (CALENDAR[cadence]) return null;
  const step = STEP[cadence] ?? 1;
  const first = dayIndex(slots[0].date);
  const last = dayIndex(slots[slots.length - 1].date);
  const at = dayIndex(date);
  if (first === null || last === null || at === null) return null;
  if (last - first !== (slots.length - 1) * step) return null;
  const index = (at - first) / step;
  return index >= 0 && index <= slots.length - 1 ? index : null;
}
