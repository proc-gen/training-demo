import { weekKeys } from "@/lib/data/weeks";
import type { Payload } from "@/lib/data/payload";

/** The week the app should open on.
 *
 * THE LATEST WEEK WHERE BOTH HALVES GRADED, not the newest manifest. The newest
 * manifest is normally the week in progress, whose activity payloads have not
 * been fetched, so opening on it shows a wall of error banners describing a week
 * that has not happened yet.
 *
 * "Either half graded" is not good enough and 2026-08-03 is why: its load
 * grades off the step export while its adherence cannot, so it would still win.
 * Both, then either, then whatever exists.
 *
 * Report's rule, so it lives with Report: nothing else in the app chooses a
 * week.
 */
export function defaultWeekKey(payload: Payload): string | null {
  const keys = weekKeys(payload);
  const both = keys.filter(
    (k) => payload.weeks[k]?.adherence && payload.weeks[k]?.load,
  );
  const either = keys.filter(
    (k) => payload.weeks[k]?.adherence || payload.weeks[k]?.load,
  );
  const pick = both.length ? both : either.length ? either : keys;
  return pick.length ? pick[pick.length - 1] : null;
}
