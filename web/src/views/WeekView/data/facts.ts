/* The adherence grader's `facts` block, read once and typed.
 *
 * `facts` is UNDECLARED in the payload schema on purpose: the graders emit
 * hundreds of fields and declaring all of them would recreate the transcription
 * problem the schema exists to remove. So the fields the page prints are pulled
 * out here, in one place, instead of through an inline
 * `as unknown as {...}` cast inside a component.
 *
 * Nothing here computes anything. If a number is not in the payload it is not
 * shown -- a second implementation of a scoring rule is exactly the drift the
 * report card exists to remove.
 */

import type { Adherence } from "@/lib/data/payload";

export type WeekFacts = {
  miles?: number;
  seconds?: number;
  planned_seconds?: unknown;
  volume_vs_plan?: number;
  /** The two halves of what `volume_vs_plan` compares, and their sum. Since
   *  2026-08-15 the check is `run so far + still prescribed` against the WEEK's
   *  own budget, rather than the running against a budget scaled down by a date
   *  count -- the two did not add up, and the athlete found it by adding them.
   *  Both are absent on a record written before that; `RunTotals` falls back to
   *  `seconds`, which is what the row showed then. */
  projected_seconds?: number;
  remaining_planned_seconds?: number;
  /** Wall-clock seconds `seconds` LEFT OUT because the prescription recovers by
   *  walking, and how many runs it came off. Zero on every week that prescribes
   *  no walking recovery. Stated on the totals row so a shrunken total does not
   *  read as a week nobody trained. */
  walk_recovery_seconds?: number;
  walk_recovery_runs?: number;
  long_run_miles?: number;
  long_run_share?: number;
  easy_seconds?: number;
  quality_seconds?: number;
  quality_share?: number;
  running_days?: number;
  rest_days?: number;
  doubles?: number;
  quality_days?: number;
  /** How many of the week's prescribed dates this block covers, out of how
   *  many there are. `judged_facts` is short of the week while it is being
   *  lived, and a scaled target that does not announce itself is
   *  indistinguishable from a wrong one. */
  prescribed_dates?: number;
  prescribed_dates_due?: number;
  graded_through?: string;
  /* `surface_miles` and `surface_share` were here until 2026-08-10. The graders
   * no longer emit them and no component reads them; see grade_week.py's
   * `monotony` tombstone for why the whole of `surface` went. */
};

/** The facts block, or null when the grader produced none.
 *
 * Null rather than an empty object, because "the week was not graded" and "the
 * week was graded and ran zero miles" are different statements and the caller
 * renders them differently.
 */
export function weekFacts(adherence: Adherence | null | undefined): WeekFacts | null {
  const f = adherence?.facts;
  if (!f) return null;
  return f as unknown as WeekFacts;
}

/** The same block over the window Structure SCORED.
 *
 * Two blocks, because the two questions have different answers while a week is
 * being lived: `facts` runs through today and is what happened, `judged_facts`
 * stops at the last date that has come due and is what may be judged. The
 * `% of plan` figure has to come from the second, or it divides a numerator
 * covering more dates than its denominator -- which read as an overshoot the
 * moment a morning run was uploaded.
 *
 * Falls back to `facts` for a record written before 2026-08-13, where the one
 * block was both.
 */
export function judgedFacts(adherence: Adherence | null | undefined): WeekFacts | null {
  const f = adherence?.judged_facts;
  if (!f) return weekFacts(adherence);
  return f as unknown as WeekFacts;
}

/** A share stored as a 0-1 fraction, as a percentage. */
export function sharePct(share: number | undefined): number {
  return (share ?? 0) * 100;
}
