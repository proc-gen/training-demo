/* The date window a trend is read over.
 *
 * WHY IT LIVES HERE. TrendsView is its only owner, and `structure.test.ts` fails
 * a module under `lib/data/` with fewer than two importers. Same placement
 * `coverage.ts` and `fitnessSeries.ts` got, for the same reason.
 *
 * THE ANCHOR IS THE NEWEST DATE IN THE DATA, NEVER A BROWSER CLOCK. A `useToday`
 * hook supplied one for a single day in this app and was deleted: an answer that
 * depends on when you look cannot be compared against the committed
 * `published/` tree, which is what every render test here is asserted against.
 * It is also the better reading -- the window ends where the measurements end,
 * so the chart is full to its right edge rather than trailing off because
 * publishing lagged. `defaultWeekKey` documents the same choice.
 *
 * EVERY DATE IS STRING SURGERY. No `Date` is constructed anywhere in this
 * module, so no timezone can reach a boundary -- the trap `format.ts` names
 * twice, where `new Date("2026-07-27")` is the previous day in every western
 * timezone. Month arithmetic is done on a year*12+month ordinal and the
 * day-of-month is clamped by a leap-year rule written out below.
 */

import { daysIn, parts } from "./dates";
import { type TrendPoint, drawn } from "./panels";

/** A window, both ends INCLUSIVE. */
export type Range = { from: string; to: string };

export type PresetKey = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

/** The offered windows, in display order.
 *
 * `months` and not a day count, because the labels say months and years: "1
 * year" as 365 days is a year everywhere except across a leap day, and a reader
 * who picks it is asking for the calendar quantity. `custom` is deliberately
 * absent -- it is a STATE the strip can be in, reached by editing a date, not a
 * button anybody presses.
 */
export const PRESETS: { key: PresetKey; label: string; months: number | null }[] = [
  { key: "1m", label: "1 month", months: 1 },
  { key: "3m", label: "3 months", months: 3 },
  { key: "6m", label: "6 months", months: 6 },
  { key: "1y", label: "1 year", months: 12 },
  { key: "all", label: "All", months: null },
];

/** Whether a string is a real calendar date in `YYYY-MM-DD`.
 *
 * The shape alone is not enough: a date input can be handed `2026-02-31` by a
 * keyboard, and a range bounded by a day that does not exist would silently
 * include or exclude the end of February depending on which side it fell.
 *
 * `parts` and `daysIn` come from `dates.ts`, which is the one place the leap
 * rule is written down -- it grew day arithmetic for the axis grid and this
 * module's copy went with the move.
 */
export function isIsoDate(s: string): boolean {
  return parts(s) !== null;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** An ISO date moved by whole CALENDAR months, the day clamped.
 *
 * The clamp is what makes "one month before 2026-03-31" answerable at all:
 * 2026-02-31 is not a date, so it becomes the 28th -- or the 29th in 2028, which
 * is why `daysIn` carries the real leap rule rather than a modulo.
 */
export function shiftMonths(iso: string, delta: number): string {
  const p = parts(iso);
  if (!p) return iso;
  const [y, mo, d] = p;
  const ordinal = y * 12 + (mo - 1) + delta;
  const ty = Math.floor(ordinal / 12);
  const tm = ordinal - ty * 12 + 1;
  return `${pad(ty, 4)}-${pad(tm, 2)}-${pad(Math.min(d, daysIn(ty, tm)), 2)}`;
}

/** Whether a preset names a window that can be STEPPED.
 *
 * The athlete's rule, stated exactly: *"if a custom time period is selected,
 * whether it's the All selection or a period not set by the buttons like 7
 * weeks, disable the buttons until a standard increment is selected."*
 *
 * Both cases fall out of `months` with no special-casing. `all` carries
 * `months: null` -- there is no period to step by, because the window IS the
 * data. `custom` is not in `PRESETS` at all, so the lookup misses and the
 * `typeof` guard catches it: a window somebody typed has no increment either.
 */
export function isShiftable(key: PresetKey): boolean {
  const months = PRESETS.find((p) => p.key === key)?.months;
  return typeof months === "number" && months > 0;
}

/** A window moved by whole preset periods, or null when it cannot be.
 *
 * BOTH ENDS MOVE BY THE SAME AMOUNT, so the window keeps its length exactly and
 * repeated stepping cannot drift -- which it would if the far end were
 * re-derived from the near one each time.
 *
 * IT MOVES THE CURRENT WINDOW, NOT THE PRESET'S IDEAL ONE. `presetRange` clamps
 * `from` to the data's own start, so on a short record the resolved window is
 * shorter than the preset names; stepping that window preserves whatever it
 * actually is rather than silently growing it back.
 *
 * The two ends are inclusive, so consecutive windows share a boundary date.
 * That is inherent to how `presetRange` already defines a window -- a "1 month"
 * window is a month and a day -- and is not introduced here.
 */
export function shiftRange(
  range: Range,
  key: PresetKey,
  steps: number,
): Range | null {
  if (!isShiftable(key)) return null;
  const months = PRESETS.find((p) => p.key === key)!.months!;
  return {
    from: shiftMonths(range.from, months * steps),
    to: shiftMonths(range.to, months * steps),
  };
}

/** The oldest and newest date ANY panel plots, or null when none plots one.
 *
 * Across every panel rather than per panel: one window governs the page, so a
 * reader who switches graph gets the same dates, and a preset means the same
 * thing whichever series is showing.
 *
 * ONLY POINTS A CHART WOULD DRAW. A null value is a date nobody measured, and a
 * window anchored on one ends where no mark is -- which is exactly what the
 * athlete found on 2026-08-15, every preset resolving against 2026-08-24
 * because two forward-authored weeks carried a null score. `trendPanels` now
 * drops those weeks outright; this is the guard that holds whatever else goes
 * null, since a week that WAS run can score null too.
 */
export function spanOf(panels: { points: TrendPoint[] }[]): Range | null {
  let first: string | null = null;
  let last: string | null = null;
  for (const p of panels) {
    for (const pt of p.points) {
      if (!drawn(pt)) continue;
      if (first === null || pt.date < first) first = pt.date;
      if (last === null || pt.date > last) last = pt.date;
    }
  }
  return first !== null && last !== null ? { from: first, to: last } : null;
}

/** The window a preset resolves to against these panels.
 *
 * `custom` resolves to nothing -- it names a window somebody typed, which only
 * the caller holding that state knows.
 */
export function presetRange(
  panels: { points: TrendPoint[] }[],
  key: PresetKey,
): Range | null {
  const span = spanOf(panels);
  if (!span || key === "custom") return null;
  const months = PRESETS.find((p) => p.key === key)?.months;
  if (months === undefined) return null;
  if (months === null) return span;
  /* CLAMPED TO THE DATA'S OWN START. A one-year window over four months of
   * measurements would otherwise report "0 of 76 points" for eight months
   * nobody recorded, and the two ends of the strip would look broken rather
   * than identical. */
  const from = shiftMonths(span.to, -months);
  return { from: from < span.from ? span.from : from, to: span.to };
}

/** The window the page opens on: the last month of data. */
export const DEFAULT_PRESET: PresetKey = "1m";

export function defaultRange(panels: { points: TrendPoint[] }[]): Range | null {
  return presetRange(panels, DEFAULT_PRESET);
}

/** The points inside a window, both ends inclusive.
 *
 * ONE RULE FOR BOTH CADENCES. A weekly point is filtered on its own week-start,
 * the date it is plotted at -- so a week that began before the window is not
 * drawn half outside it, and the x axis never claims to cover more than the
 * window states.
 */
export function pointsIn(points: TrendPoint[], range: Range | null): TrendPoint[] {
  if (!range) return points;
  return points.filter((p) => p.date >= range.from && p.date <= range.to);
}

/** How many of these points a chart would actually draw.
 *
 * A null value is a day nobody measured and `LineChart` skips it, so counting
 * the array would promise marks that never appear. `drawn` is the one definition
 * of that, and it answers for a multi-series point too -- where "measured" means
 * ANY of its series carried a value.
 */
export function plotted(points: TrendPoint[]): number {
  return points.filter(drawn).length;
}
