/* The newest date the payload MEASURED.
 *
 * View-local in `views/CalendarView/data/window.ts` until 2026-08-26, when the
 * Trends pace panel became its second consumer -- proximity follows reuse. It is
 * the same domain question both times, backed by the same athlete ruling: a
 * window anchors on the newest measurement, never a browser clock and never the
 * plan. Two unshared copies of a POLICY would be the drift the sanctioned-
 * duplication pattern exists to prevent; there is no `test_athlete_paths.py`
 * on this side of the toolchain to keep them honest.
 *
 * BACK TO ONE CONSUMER, AND SO BACK BESIDE IT (2026-10-05). The calendar's
 * anchor now keys on the newest STEP total (`window.newestStepDate`) by the
 * athlete's ruling, so a wellness-only morning no longer opens a new week; the
 * Trends pace panel keeps this broader "any day record" meaning. Proximity
 * follows reuse in both directions.
 */

import type { Payload } from "@/lib/data/payload";

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
