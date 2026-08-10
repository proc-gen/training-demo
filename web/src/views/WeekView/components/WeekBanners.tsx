"use client";

import type { Week } from "@/lib/data/payload";
import { Banner } from "@/lib/ux/primitives/Banner";

/** Everything ACTIONABLE that qualifies the week, above the numbers it qualifies.
 *
 * A grader that FAILED gets a stop banner naming its reason -- the same
 * exactly-one-is-null contract the payload holds, surfaced. The load grader's
 * caveats are ordinary banners: they qualify data that IS there.
 *
 * A CAVEAT WITH A HOME OF ITS OWN IS NOT A BANNER, and there are two kinds.
 *
 * `permanent` is one nobody can ever act on -- a week whose Runalyze training
 * state was never captured, which `get_calculations()` being current-only makes
 * unrecoverable. AcwrTable renders it beside the `--` that is its only visible
 * consequence.
 *
 * `flag` is a footnote to one flag rather than a headline about the week --
 * `strain-spike` firing against a threshold `model.json` itself calls an
 * uncalibrated placeholder. FlagsCard renders it under that flag's row.
 *
 * Both are still true and still worth saying. A banner repeated on every visit
 * stops being read, and it drowns the ones that mean go and fix something.
 */
export function WeekBanners({
  week,
  banners,
}: {
  week: Week;
  banners: string[];
}) {
  return (
    <>
      {banners.map((b, i) => (
        <Banner key={i} stop>
          {b}
        </Banner>
      ))}
      {week.adherence_error ? (
        <Banner stop>
          <b>Adherence not graded. </b>
          {week.adherence_error}
        </Banner>
      ) : null}
      {week.load_error ? (
        <Banner stop>
          <b>Load not graded. </b>
          {week.load_error}
        </Banner>
      ) : null}
      {(week.load?.caveats ?? [])
        .filter((c) => !c.permanent && !c.flag)
        .map((c, i) => (
          <Banner key={i}>{c.text}</Banner>
        ))}
    </>
  );
}
