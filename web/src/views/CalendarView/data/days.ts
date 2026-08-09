/* What the calendar needs out of the payload, decided once and testably.
 *
 * NOTHING HERE IS RE-DERIVED. Roles, ceilings and SE come from whichever graded
 * week covers the date; a date the graders never scored simply has none. The
 * viewer computing an SE would put a second copy of the load model in the front
 * end, which is the drift the report card exists to remove.
 */

import { n } from "@/lib/data/format";
import type { Day, LoadDay, Payload } from "@/lib/data/payload";

/** Every day the step/wellness series carries, in payload order. */
export function calendarDays(payload: Payload): Day[] {
  return (payload.days ?? []).filter((d) => d.date);
}

/** Date -> the load grader's record for it, across every graded week. */
export function loadByDate(payload: Payload): Map<string, LoadDay> {
  const meta = new Map<string, LoadDay>();
  for (const w of Object.values(payload.weeks ?? {})) {
    for (const d of w.load?.days ?? []) meta.set(d.date, d);
  }
  return meta;
}

/** Date -> the day's steps/wellness row. */
export function dayByDate(days: Day[]): Map<string, Day> {
  const byDate = new Map<string, Day>();
  for (const d of days) byDate.set(d.date, d);
  return byDate;
}

/** The busiest day on record, in STEPS, which is what the bars are scaled to.
 *
 * NOT step-equivalents. Only a graded week has an SE figure -- SE is
 * `run_steps x run_step_weight + nonrun_steps` -- so scaling graded days in SE
 * and the rest in steps, which is what this first did, puts two different units
 * on one length: an 18,000-step ungraded day drew SHORTER than a 15,258-SE
 * graded day with fewer actual steps. Steps are measured every day, so steps
 * are what the bars mean.
 *
 * Floors at 1 so the ratio cannot divide by zero on a payload of empty days.
 */
export function maxSteps(days: Day[]): number {
  let max = 1;
  for (const d of days) {
    const t = n(d.total_steps);
    if (t) max = Math.max(max, t);
  }
  return max;
}

/** Whether a day went over a ceiling that actually exists.
 *
 * BOTH halves are required. A day with no SE was never scored, and a day with
 * no ceiling is one the plan did not price -- outlining either states a breach
 * of a standard nobody set.
 */
export function isOverCeiling(m: LoadDay | undefined): boolean {
  return Boolean(m?.se && m?.ceiling && m.se > m.ceiling);
}
