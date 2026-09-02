/* Calendar periods for the aggregated trend series.
 *
 * The athlete's 2026-09-02 request: the volume, quality-share and load graphs
 * take an aggregation PERIOD — weekly, bi-weekly, monthly, yearly — in both
 * modes. In boundaries mode a period is a calendar bucket and this module names
 * its buckets; in rolling mode it is a trailing window and `rollingDays` is its
 * length.
 *
 * EVERY PERIOD IS A PURE FUNCTION OF THE DATE, never of the data. The fortnight
 * is the one with a choice to make — pairs of Mon–Sun weeks need an anchor —
 * and it anchors on a FIXED EPOCH MONDAY (1969-12-29, the Monday of the week
 * holding day zero) rather than on the newest or oldest week in the record.
 * Anchored on the data, adding one new week would reshuffle every historical
 * fortnight; anchored on the epoch, a date's bucket never moves.
 *
 * Built solely on `dates.ts` — no `Date` constructed, the view's standing rule.
 */

import { dateFromIndex, dayIndex, monthOrdinal, yearOf } from "./dates";
import type { Cadence } from "./panels";

export type Period = "weekly" | "biweekly" | "monthly" | "yearly";

/** The offered periods, in display order.
 *
 * `rollingDays` is the trailing-window length rolling mode uses — 30 and 365
 * rather than a calendar month or year, because a window evaluated per day has
 * to have ONE length. The labels stay the calendar words in both modes, the
 * athlete's choice (2026-09-02) over relabelling to `30d`/`365d` when rolling.
 */
export const PERIODS: {
  key: Period;
  label: string;
  cadence: Cadence;
  rollingDays: number;
}[] = [
  { key: "weekly", label: "Weekly", cadence: "week", rollingDays: 7 },
  { key: "biweekly", label: "Bi-weekly", cadence: "fortnight", rollingDays: 14 },
  { key: "monthly", label: "Monthly", cadence: "month", rollingDays: 30 },
  { key: "yearly", label: "Yearly", cadence: "year", rollingDays: 365 },
];

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** Which bucket a date falls in, as an ordinal that compares across years.
 *
 * Weeks and fortnights count Mon-started periods from the epoch (1970-01-01
 * was a Thursday, hence the +3 — the same shift `weekdayOf` and `ticks.ts`
 * use); months are `year * 12 + month - 1` and years the year itself. Null for
 * anything that is not a date.
 */
export function periodOrdinal(iso: string, period: Period): number | null {
  switch (period) {
    case "weekly": {
      const i = dayIndex(iso);
      return i === null ? null : Math.floor((i + 3) / 7);
    }
    case "biweekly": {
      const i = dayIndex(iso);
      return i === null ? null : Math.floor((i + 3) / 14);
    }
    case "monthly":
      return monthOrdinal(iso);
    case "yearly":
      return yearOf(iso);
  }
}

/** The first day of a bucket — the date its point is plotted at. */
export function periodStartOf(ordinal: number, period: Period): string {
  switch (period) {
    case "weekly":
      return dateFromIndex(ordinal * 7 - 3);
    case "biweekly":
      return dateFromIndex(ordinal * 14 - 3);
    case "monthly": {
      const y = Math.floor(ordinal / 12);
      const m = ordinal - y * 12 + 1;
      return `${pad(y, 4)}-${pad(m, 2)}-01`;
    }
    case "yearly":
      return `${pad(ordinal, 4)}-01-01`;
  }
}

/** How many days the bucket holding this date has.
 *
 * Derived from the NEXT bucket's start rather than from a table, so February
 * and leap years fall out of `dateFromIndex`'s own calendar and the two can
 * never disagree.
 */
export function periodLength(iso: string, period: Period): number | null {
  const ord = periodOrdinal(iso, period);
  if (ord === null) return null;
  const start = dayIndex(periodStartOf(ord, period));
  const next = dayIndex(periodStartOf(ord + 1, period));
  return start === null || next === null ? null : next - start;
}
