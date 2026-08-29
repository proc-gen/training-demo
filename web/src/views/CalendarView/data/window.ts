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

import { newestMeasuredDate } from "@/lib/data/measured";
import type { Payload } from "@/lib/data/payload";
import { addDays, mondayOf, weekEnding } from "@/lib/data/weekDates";

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

/** The window the page opens on: the last day of measured data.
 *
 * `newestMeasuredDate` lived here until the Trends pace panel became its second
 * consumer; it is `@/lib/data/measured` now, docstring and all.
 *
 * Falls back to the newest week's END where nothing has been measured at all --
 * a fresh athlete with a plan and no exports still gets a grid rather than an
 * empty state, and the plan is the only thing there is to show them.
 *
 * IT IS THE REFERENCE NOW, NOT THE IMPLEMENTATION (2026-08-29). The anchor is a
 * ROUTE, so the default is resolved in `slices.defaultAnchor` -- in SQL, and
 * normalised to the week's Sunday, because a URL has to name one date where all
 * seven name the same window. `slices.test.ts` asserts the two agree over the
 * committed tree, which is this function's job now: the readable implementation
 * a faster one is proven equal to, the same shape `lib/db/records.ts` has
 * against the index.
 */
export function defaultLastDay(payload: Payload): string | null {
  const measured = newestMeasuredDate(payload);
  if (measured) return measured;
  const keys = Object.keys(payload.weeks ?? {}).sort();
  const last = keys[keys.length - 1];
  return last ? addDays(mondayOf(last), 6) : null;
}

/** The anchor a URL asks for, normalised, or `fallback` where it asks for none.
 *
 * THE ANCHOR IS A QUERY PARAMETER NOW (2026-08-29) -- `/calendar?end=<sunday>`
 * -- and it used to be a route SEGMENT. The segment had to be enumerated by
 * `generateStaticParams` for the static export, which is the only reason
 * `ANCHOR_MARGIN_WEEKS` ever existed: the demo 404'd twenty-six weeks either
 * side of the record while the private app's own stepper was deliberately
 * unbounded. A query parameter is read from the URL by the browser, so there is
 * nothing to enumerate and nothing to bound, and BOTH apps carry the same URL.
 *
 * IT VALIDATES RATHER THAN TRUSTING, because a query parameter is typed by
 * hand. `?end=2026-02-31` is a real thing a URL can say and not a real day, and
 * a window bounded by a day that does not exist lands its grid wherever `Date`
 * decided to roll it over to.
 *
 * IT NORMALISES TO THE WEEK'S SUNDAY, which the segment got for free from
 * `generateStaticParams` naming only Sundays. Every one of a week's seven dates
 * selects the same window, and the URL has to name it once or the same grid
 * exists at seven addresses. The GRID does not need this -- `weekRowsEnding`
 * takes `mondayOf` of whatever it is handed -- the ADDRESS does.
 */
export function resolveAnchor(
  raw: string | string[] | undefined,
  fallback: string | null,
): string | null {
  // An array means the parameter was repeated; the first wins, which is what a
  // reader editing a URL by hand means by it.
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string" && isIsoDate(value)) return weekEnding(value);
  return fallback;
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

/** The last day moved by whole windows, `steps` negative for earlier.
 *
 * THE INCREMENT IS WHATEVER THE GRID IS SHOWING. At 2w the arrows move a
 * fortnight and at 4w a month, which is the athlete's own statement of it:
 * *"if 2 weeks is selected, move back and forth by 2 week increments."* So the
 * window that replaces the one on screen is the one immediately beside it, with
 * no overlap and no gap -- `7 x weeks` days moves `weekRowsEnding`'s rows by
 * exactly `weeks` whole rows, because every row is seven days and the window is
 * anchored on `mondayOf(lastDay)`.
 *
 * IT IS NEVER BOUNDED BY THE DATA. The athlete's decision, and it matches the
 * date field beside it, which has never been bounded either: stepping past the
 * record draws a grid of empty cells, which is an honest answer rather than a
 * disabled button that cannot say why. The alternative -- disabling at the edge
 * of what has been measured -- also has to decide what "the edge" is on a view
 * that deliberately reaches into a plan authored months ahead.
 */
export function stepLastDay(
  lastDay: string,
  weeks: number,
  steps: number,
): string {
  return addDays(lastDay, 7 * weeks * steps);
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
