/* Reading a load day's own account of itself.
 *
 * ONE FUNCTION, AND IT IS HERE BECAUSE TWO VIEWS ASK IT. The Week tab's day
 * table puts the answer in the Score column and the Calendar's day card puts it
 * in the Load list; both are showing the same day and must give it the same
 * word. Two copies of a wording rule is exactly the drift the report card exists
 * to remove -- and the wording is the whole content here, so a second copy would
 * be the entire function duplicated.
 */

import type { LoadDay } from "./payload";

/** Why a day is reported but not scored. NEVER a bare dash.
 *
 * Three completely different states arrive at the same empty cell, and one dash
 * distinguishes none of them:
 *
 *   in-progress   the day is still being lived, so its step total measures the
 *                 morning rather than the day
 *   partial-*     the export half-covered it, so the total is not a measurement
 *   unpriced      the export covered it perfectly well and the PLAN did not
 *                 state a duration for every run on it, so half a prescription
 *                 could not price a ceiling
 *
 * `unpriced` is the one that is not a completeness value at all -- reading
 * `full` there would be true and useless -- so it is tested for first, off the
 * pair that defines it: an SE exists and no ceiling does.
 */
export function unscoredReason(d: LoadDay | undefined): string {
  if (!d) return "--";
  if (d.se != null && d.ceiling == null) return "unpriced";
  return d.completeness || "--";
}
