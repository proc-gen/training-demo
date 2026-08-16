/* Which dates the calendar draws.
 *
 * The grid used to be every date `payload.days` carried and nothing else, which
 * is measured dates only -- so the view could not reach a session the plan
 * states for next Tuesday, and it grew by one row a week forever. It is a
 * WINDOW now: a last day, and a number of weeks back from it.
 *
 * THE DEFAULT ANCHOR IS THE NEWEST DATE IN THE DATA, NEVER A BROWSER CLOCK.
 * That is `range.ts`'s rule and `defaultWeekKey`'s, for the third time, and it
 * is what lets every render case be asserted against the committed `published/`
 * tree instead of against the day the suite happens to run. The newest
 * MEASUREMENT, specifically -- so the view opens on the weeks that were lived
 * rather than on a plan authored two Mondays ahead, and reaching the plan is
 * one edit of the date field.
 *
 * ROWS ARE WHOLE MON-SUN WEEKS. The chosen last day selects WHICH WEEK is last;
 * it does not cut that week short. A window ending mid-week would put some
 * Wednesdays in one column and the rest in another, and a grid whose weekdays
 * do not line up is not a calendar -- the same reasoning `calendarRows` gives
 * for rendering an empty slot rather than skipping it.
 *
 * EVERY DATE IS STRING SURGERY, except where `grid.ts` already parses at noon.
 * `range.ts` states the trap at length: `new Date("2026-07-27")` is UTC
 * midnight, which is the previous day in every western timezone.
 */

import type { Payload } from "@/lib/data/payload";
import { addDays, mondayOf } from "./grid";

/** How many weeks the grid may show. */
export const WEEK_CHOICES = [1, 2, 3, 4, 5, 6] as const;

/** What it opens on. Four weeks is a training block's worth of context -- long
 *  enough to see a pattern, short enough that a cell stays readable. */
export const DEFAULT_WEEKS = 4;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days in a month, 1-indexed. The leap rule in full, not `y % 4`. */
function daysIn(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Whether a string is a real calendar date in `YYYY-MM-DD`.
 *
 * The shape alone is not enough: a date input can be handed `2026-02-31` by a
 * keyboard, and a window bounded by a day that does not exist would land its
 * grid on whatever `Date` decided to roll that over to.
 *
 * DUPLICATED FROM `views/TrendsView/data/range.ts` RATHER THAN SHARED. Moving
 * it to `lib/data/` for two callers would be right if it were a measurement;
 * it is six lines of calendar arithmetic, and the two views' date handling is
 * otherwise entirely separate -- one resolves month presets, this one resolves
 * week rows. A shared module here would be a drawer of general utilities, which
 * is what the proximity rule exists to prevent.
 */
export function isIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysIn(y, mo);
}

/** The newest date the payload MEASURED, or null.
 *
 * `payload.days` is the steps/wellness join, so it stops at the last day an
 * export covered. Deliberately not the newest week record, which reaches into
 * the plan: opening on a week nobody has run is the defect `defaultWeekKey`
 * fixed on 2026-08-14, and this is the same question one view over.
 */
export function newestMeasuredDate(payload: Payload): string | null {
  let newest: string | null = null;
  for (const d of payload.days ?? []) {
    const date = d.date;
    if (date && (newest === null || date > newest)) newest = date;
  }
  return newest;
}

/** The window the page opens on: the last day of measured data.
 *
 * Falls back to the newest week's END where nothing has been measured at all --
 * a fresh athlete with a plan and no exports still gets a grid rather than an
 * empty state, and the plan is the only thing there is to show them.
 */
export function defaultLastDay(payload: Payload): string | null {
  const measured = newestMeasuredDate(payload);
  if (measured) return measured;
  const keys = Object.keys(payload.weeks ?? {}).sort();
  const last = keys[keys.length - 1];
  return last ? addDays(mondayOf(last), 6) : null;
}

/** `weeks` Monday-based rows ending with the week that contains `lastDay`.
 *
 * Each row is seven ISO dates -- never a null, unlike `calendarRows`, which
 * this replaced. That function drew a slot for a date and left it blank where
 * no measurement existed; a window states its own dates, and a day with no
 * steps is a day with no steps rather than a hole in the calendar. It may still
 * carry a prescription, which is the whole point.
 */
export function weekRowsEnding(
  lastDay: string,
  weeks: number,
): { start: string; days: string[] }[] {
  const lastStart = mondayOf(lastDay);
  const rows: { start: string; days: string[] }[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(lastStart, -7 * i);
    rows.push({
      start,
      days: Array.from({ length: 7 }, (_, d) => addDays(start, d)),
    });
  }
  return rows;
}

/** A week count clamped to what the strip offers.
 *
 * State arriving from outside -- a restored form control, a future URL
 * parameter -- must not be able to ask for 400 rows or for zero.
 */
export function clampWeeks(n: number): number {
  const first = WEEK_CHOICES[0];
  const last = WEEK_CHOICES[WEEK_CHOICES.length - 1];
  if (!isFinite(n)) return DEFAULT_WEEKS;
  return Math.min(last, Math.max(first, Math.round(n)));
}
