/* Calendar arithmetic on ISO strings, with NO `Date` CONSTRUCTED.
 *
 * The rule `range.ts` has held since it was written: `new Date("2026-07-27")`
 * is UTC midnight, which is the previous day in every western timezone, so a
 * single parse anywhere in this view would move a window boundary by a day for
 * half the world. Everything here is integer arithmetic on the three numbers in
 * the string.
 *
 * WHY IT IS ITS OWN MODULE. `range.ts` needed only month shifts; densifying a
 * series onto a daily or weekly grid needs day shifts, a weekday and a month
 * ordinal too. `daysIn` moved here rather than being copied, so the leap rule
 * has one implementation -- the same reasoning that keeps one `niceStep`.
 *
 * `dayIndex` is Howard Hinnant's days-from-civil: exact for every date in this
 * era, no floating point, and its inverse round-trips.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Days in a month, 1-indexed. The leap rule in full, not `y % 4`. */
export function daysIn(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** The three numbers in an ISO date, or null if it is not one. */
export function parts(iso: string): [number, number, number] | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null;
  return [y, mo, d];
}

/** Days since 1970-01-01, or null for anything that is not a date.
 *
 * Days-from-civil: the year is shifted to start in March so the leap day lands
 * at the end of it, which is what removes every special case from the count.
 */
export function dayIndex(iso: string): number | null {
  const p = parts(iso);
  if (!p) return null;
  const [y, m, d] = p;
  const shifted = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(shifted / 400);
  const yoe = shifted - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The inverse of `dayIndex`. */
export function dateFromIndex(index: number): string {
  const z = Math.trunc(index) + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) /
      365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = era * 400 + yoe + (m <= 2 ? 1 : 0);
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** An ISO date moved by whole days, or the input back if it is not a date. */
export function addDays(iso: string, delta: number): string {
  const i = dayIndex(iso);
  return i === null ? iso : dateFromIndex(i + delta);
}

/** 0 for Monday through 6 for Sunday.
 *
 * MONDAY-BASED, because a training week starts on one here: every manifest and
 * every snapshot is named for a Monday, so a week tick has to land on the same
 * day the records do. 1970-01-01 was a Thursday, which is the +3.
 */
export function weekdayOf(iso: string): number | null {
  const i = dayIndex(iso);
  return i === null ? null : (((i + 3) % 7) + 7) % 7;
}

/** Months since year 0, so two dates in different years still compare. */
export function monthOrdinal(iso: string): number | null {
  const p = parts(iso);
  return p ? p[0] * 12 + (p[1] - 1) : null;
}

/** The four-digit year, as a number. */
export function yearOf(iso: string): number | null {
  const p = parts(iso);
  return p ? p[0] : null;
}
