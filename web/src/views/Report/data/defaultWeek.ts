import { hasRuns, weekKeys } from "@/lib/data/weeks";
import type { Payload } from "@/lib/data/payload";

/** The week the app should open on.
 *
 * THE LATEST WEEK THAT HAS BEEN LIVED, not the newest manifest and not the
 * newest one that graded. The newest manifest used to be the week in progress;
 * since 2026-08-14 the plan reaches TWO MONDAYS AHEAD, and a week that has not
 * started grades both halves perfectly well -- every run `pending`, every score
 * null. So "both halves graded" started landing the reader on an empty card two
 * weeks in the future, which is where the athlete found it.
 *
 * A week HAS BEEN LIVED when its adherence grade carries at least one measured
 * run. That is a fact about the record rather than a comparison against today,
 * so it stays a pure function of the tree -- the same property that lets
 * `published/` be committed and compared against a fresh build.
 *
 * "Either half graded" is not good enough and 2026-08-03 is why: its load
 * grades off the step export while its adherence cannot, so it would still win.
 * Lived, then both, then either, then whatever exists.
 *
 * Report's rule, so it lives with Report: nothing else in the app chooses a
 * week. THE PREDICATE is shared, though — `hasRuns` moved to `lib/data/weeks`
 * on 2026-08-15 when the trend panels needed the same question answered, and two
 * copies of "has this week been run" is how they come to disagree.
 */
export function defaultWeekKey(payload: Payload): string | null {
  const keys = weekKeys(payload);
  const lived = keys.filter((k) => hasRuns(payload.weeks[k]));
  const both = keys.filter(
    (k) => payload.weeks[k]?.adherence && payload.weeks[k]?.load,
  );
  const either = keys.filter(
    (k) => payload.weeks[k]?.adherence || payload.weeks[k]?.load,
  );
  const pick = lived.length
    ? lived
    : both.length
      ? both
      : either.length
        ? either
        : keys;
  return pick.length ? pick[pick.length - 1] : null;
}
