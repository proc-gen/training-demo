/* Which dates on a time axis get a label.
 *
 * CALENDAR-ALIGNED, NOT EVERY NTH SLOT. `labelStride` thins by counting back
 * from the newest column, which is right for a week of days and arbitrary over
 * a year: it produces `8/25, 9/22, 10/20` -- dates that mean nothing except
 * that they are 28 apart. A reader scanning a twelve-month window is looking
 * for months, so the ladder below labels the first slot of each real calendar
 * period and steps up a rung until the labels fit.
 *
 * THE LAST DATE IS ALWAYS A TICK. The newest point is what a reader anchors on
 * -- the same rule `labelStride`'s count-back exists to hold -- and a calendar
 * boundary lands there only by luck. A generated tick too close to it is
 * dropped rather than overprinted.
 *
 * Pure and testable, and it knows nothing about pixels: the caller works out
 * how many labels fit and this decides WHICH.
 */

import { dayIndex, monthOrdinal } from "./dates";

/** Mondays start a period. 1970-01-01 was a Thursday, hence the +3. */
function weekOrdinal(iso: string): number | null {
  const i = dayIndex(iso);
  return i === null ? null : Math.floor((i + 3) / 7);
}

/** The rungs, finest first.
 *
 * `every` is applied to the ORDINAL, not to the count of periods present, so a
 * quarter is January/April/July/October rather than "every third month that
 * happens to be in the data". Month ordinals are `year * 12 + month - 1`, which
 * is why `% 3` lands on the calendar quarters and `% 12` on January.
 */
const LEVELS: { of: (iso: string) => number | null; every: number }[] = [
  { of: dayIndex, every: 1 },
  { of: dayIndex, every: 2 },
  { of: weekOrdinal, every: 1 },
  { of: weekOrdinal, every: 2 },
  { of: monthOrdinal, every: 1 },
  { of: monthOrdinal, every: 2 },
  { of: monthOrdinal, every: 3 },
  { of: monthOrdinal, every: 6 },
  { of: monthOrdinal, every: 12 },
];

/** The first date in the series inside each period this rung selects.
 *
 * THE FIRST SLOT IN THE PERIOD, never the period's own first day: a weekly
 * series is all Mondays and contains no 1st of the month at all, so a rule that
 * looked for the boundary date itself would label nothing.
 */
function ticksAt(
  dates: string[],
  level: { of: (iso: string) => number | null; every: number },
): string[] {
  const seen = new Set<number>();
  const out: string[] = [];
  for (const d of dates) {
    const ord = level.of(d);
    if (ord === null || ord % level.every !== 0 || seen.has(ord)) continue;
    seen.add(ord);
    out.push(d);
  }
  return out;
}

/** The dates that carry an x-axis label, in order.
 *
 * `maxLabels` is how many the axis has room for. The finest rung whose count
 * fits wins; if even a January-only axis is too many for the space, the
 * coarsest is thinned by counting back from the end -- the newest first, again.
 *
 * BOTH EDGES ARE ALWAYS TICKS and a boundary that crowds one is dropped. The
 * first slot and the last are what the axis runs BETWEEN, and a calendar
 * boundary lands on either only by luck: a year of days beginning 2025-08-25
 * has its September boundary seven slots in, which at a dozen labels across the
 * plot is two labels in one place.
 */
export function axisTicks(dates: string[], maxLabels: number): string[] {
  if (!dates.length) return [];
  const n = dates.length;
  const budget = Math.max(1, Math.floor(maxLabels));
  if (n === 1 || budget === 1) return [dates[n - 1]];

  /* How close a boundary may come to an EDGE, in slots: how many slots ONE
     LABEL occupies at this budget. Anything nearer overprints, and the boundary
     is what gives way -- an edge is where the axis starts and stops.

     ROUNDED UP, and the difference is a real defect rather than a nicety: a
     month of days at a budget of 24 gives 31/24, which floored is 1 -- so a
     window opening on 7/21 labelled 7/22 one slot along, two labels in the
     space of one.

     IT IS NOT APPLIED BETWEEN INTERIOR TICKS, which is the whole point of the
     ladder: thinning a fine rung until it happens to fit would return every
     other Monday under the name of a calendar axis, which is the arbitrary
     spacing this module exists to replace. Rungs are chosen whole. */
  const gap = Math.max(1, Math.ceil((n - 1) / budget));
  const index = new Map(dates.map((d, i) => [d, i]));

  const withEdges = (picked: string[]): string[] => {
    const keep = picked
      .map((d) => index.get(d))
      .filter((i): i is number => i !== undefined && i >= gap && i <= n - 1 - gap);
    return [dates[0], ...keep.map((i) => dates[i]), dates[n - 1]];
  };

  for (const level of LEVELS) {
    const picked = withEdges(ticksAt(dates, level));
    if (picked.length <= budget) return picked;
  }

  /* Coarser than a year is not a calendar period anybody reads, so the last
     rung is thinned instead. Counted back from the end for the usual reason. */
  const coarsest = withEdges(ticksAt(dates, LEVELS[LEVELS.length - 1]));
  const stride = Math.ceil(coarsest.length / budget);
  return coarsest.filter((_, i) => (coarsest.length - 1 - i) % stride === 0);
}
