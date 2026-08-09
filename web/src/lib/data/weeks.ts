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

import type { Payload } from "./payload";

/** Every week key, chronological. */
export function weekKeys(payload: Payload): string[] {
  return Object.keys(payload.weeks ?? {}).sort();
}
