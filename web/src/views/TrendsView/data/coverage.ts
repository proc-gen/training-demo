import type { Week } from "@/lib/data/payload";

/** Whether every day of this week has been LIVED.
 *
 * `hasRuns` asks whether anything was measured, which is the right question for
 * a series of measurements and the wrong one for a week that was fully lived
 * and contained no running: `facts.miles` of `0.0` on 2026-03-16 is a
 * measurement -- the record's own note calls that week "the glute layoff, the
 * record's longest" -- while the same `0.0` on 2026-08-24 is a plan nobody has
 * started. Six such weeks sit inside the last year and the volume chart drew a
 * straight line across all of them.
 *
 * `elapsed_days`, which the grader publishes on every week, is what tells the
 * two apart: 7 on a week that is over, 5 on the one in progress, 0 on the two
 * the plan reaches ahead into. THE WHOLE WEEK, NOT ANY OF IT -- a Wednesday
 * with no runs yet is not a zero-mileage week, it is a Wednesday.
 */
export function isLived(week: Week | undefined): boolean {
  const facts = week?.adherence?.facts as { elapsed_days?: number } | null | undefined;
  return facts?.elapsed_days === 7;
}

/** Whether the step export only half covered this week.
 *
 * READ FROM THE FLAG, never re-counted. The load grader already decides this
 * and a second implementation here could disagree with the page's own load
 * table. A partly-covered week sums fewer days, so plotting its total beside
 * full weeks reads as a collapse in training -- which is why the trends panel
 * drops it and says so.
 */
export function isIncomplete(week: Week | undefined): boolean {
  return (week?.load?.flags ?? []).some(
    (f) => f.token === "steps-data-incomplete" && f.status === "fired",
  );
}
