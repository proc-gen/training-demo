import type { Week } from "@/lib/data/payload";

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
