"use client";

import type { Week } from "@/lib/data/payload";
import { Banner } from "@/lib/ux/primitives/Banner";

/** Everything ACTIONABLE that qualifies the week, above the numbers it qualifies.
 *
 * A grader that FAILED gets a stop banner naming its reason -- the same
 * exactly-one-is-null contract the payload holds, surfaced. The load grader's
 * caveats are ordinary banners: they qualify data that IS there.
 *
 * PERMANENT CAVEATS ARE FILTERED OUT HERE. A caveat that nobody can ever act on
 * -- a week whose Runalyze `calculations` payload was never captured, which
 * `get_calculations()` being current-only makes unrecoverable -- would sit at
 * the top of that week forever. It is still true and still worth saying, so it
 * moves to the row it explains: AcwrTable renders it beside the `--` that is
 * its only visible consequence. A banner repeated on every visit stops being
 * read, and it drowns the ones that mean go and fix something.
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
        .filter((c) => !c.permanent)
        .map((c, i) => (
          <Banner key={i}>{c.text}</Banner>
        ))}
    </>
  );
}
