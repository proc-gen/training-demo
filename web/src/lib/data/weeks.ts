/* Week selection. Pure, so it is testable.
 *
 * SHARED because Report and TrendsView both walk the week list. Its three
 * former neighbours each had exactly one caller and moved to that caller:
 *
 *   defaultWeekKey -> views/Report/data/defaultWeek.ts
 *   isIncomplete   -> views/TrendsView/data/coverage.ts
 *   calendarRows   -> views/CalendarView/data/grid.ts
 *
 * Each of those carries a documented decision that belongs beside the view that
 * makes it, rather than in a drawer of general utilities.
 */

import type { Payload, Week } from "./payload";

/** Every week key, chronological. */
export function weekKeys(payload: Payload): string[] {
  return Object.keys(payload.weeks ?? {}).sort();
}

/** Whether this week has actually been RUN — at least one measured run in it.
 *
 * SHARED because two callers ask the same question of the record: `defaultWeek`
 * picks the newest week that has been lived, and the trend panels refuse to plot
 * one that has not.
 *
 * IT IS A FACT ABOUT THE RECORD, NOT A COMPARISON AGAINST TODAY, which is what
 * keeps both callers pure functions of the tree.
 *
 * WHY THE TRENDS NEED IT. The plan reaches two Mondays ahead, so
 * `published/weeks/` carries records for weeks nobody has run — and those
 * records are not empty. `facts.miles` is `0.0`, `facts.quality_share` is `0`
 * and `load.integrity.total` is `0`, all of which are perfectly good numbers and
 * none of which is a measurement. Plotted, they read as a collapse in training:
 * the athlete watched Quality share and Total load both fall to the floor at
 * 2026-08-24, a week that had not started. **A week that has not happened is not
 * a week of no training**, which is the same rule that drops a partly-covered
 * week from the total-load trend.
 *
 * `results` and not `scores`: a score can legitimately be null on a week that
 * WAS run — nothing scoreable came due yet — and the question here is whether
 * anything was measured at all.
 */
export function hasRuns(week: Week | undefined): boolean {
  return (week?.adherence?.results ?? []).length > 0;
}
