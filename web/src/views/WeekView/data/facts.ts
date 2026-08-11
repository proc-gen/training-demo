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
  long_run_miles?: number;
  long_run_share?: number;
  easy_seconds?: number;
  quality_seconds?: number;
  quality_share?: number;
  running_days?: number;
  rest_days?: number;
  doubles?: number;
  quality_days?: number;
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

/** A share stored as a 0-1 fraction, as a percentage. */
export function sharePct(share: number | undefined): number {
  return (share ?? 0) * 100;
}
