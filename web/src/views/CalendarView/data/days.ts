/* What the calendar needs out of the payload, decided once and testably.
 *
 * NOTHING HERE IS RE-DERIVED. Roles, ceilings, SE and every run's score come
 * from whichever week covers the date; a date the graders never scored simply
 * has none. The viewer computing an SE -- or averaging a day's runs into a
 * single adherence figure -- would put a second copy of a scoring rule in the
 * front end, which is the drift the report card exists to remove. A day with
 * two runs shows two percentages.
 */

import { n } from "@/lib/data/format";
import type { Day, LoadDay, Payload, RunResult, Week } from "@/lib/data/payload";
import { sortedRuns } from "@/lib/run/data/runs";
import { mondayOf } from "./grid";

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

/** Date -> its runs, completed and planned together, in report order.
 *
 * BOTH LISTS, through `sortedRuns` -- the same function the Week tab's table
 * uses, so the calendar and the runs table cannot disagree about what a day
 * holds or what order it happened in. The grader keeps the two apart so a
 * planned run cannot reach a measurement; that is a scoring concern, and this
 * is a reading one.
 *
 * Every week in the payload, not just the graded ones: a week authored two
 * Mondays out has nine planned runs and no results at all, and those are
 * exactly the days this view could not previously reach.
 */
export function runsByDate(payload: Payload): Map<string, RunResult[]> {
  const byDate = new Map<string, RunResult[]>();
  for (const w of Object.values(payload.weeks ?? {})) {
    if (!w.adherence) continue;
    for (const r of sortedRuns(w.adherence)) {
      if (!r.date) continue;
      const list = byDate.get(r.date);
      if (list) list.push(r);
      else byDate.set(r.date, [r]);
    }
  }
  return byDate;
}

/** The week record covering a date, or undefined.
 *
 * Week keys ARE Mondays -- the manifests open on Monday and `week_start` names
 * the file -- so this is arithmetic rather than a search through the catalog.
 */
export function weekFor(payload: Payload, date: string): Week | undefined {
  return (payload.weeks ?? {})[mondayOf(date)];
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
 * OVER THE WHOLE RECORD, NOT THE WINDOW. Scaling to the busiest day on screen
 * would make every bar jump the moment the reader changed the week count, so
 * two windows of the same data would tell different stories. The cost is that a
 * quiet month draws short, which is true.
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
