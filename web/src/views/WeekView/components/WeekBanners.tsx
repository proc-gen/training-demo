"use client";

import type { Week } from "@/lib/data/payload";
import { Banner } from "@/lib/ux/primitives/Banner";

/** WHAT FAILED TO BUILD, above the space where it would have been.
 *
 * Two kinds, and both are about a thing that is ABSENT rather than about a
 * number that is present:
 *
 *   `banners`                    a SKILL is not installed, so half the report
 *                                does not exist on this checkout
 *   `adherence_error`/`load_error`  a grader CRASHED, so this week's half of the
 *                                page is a blank card
 *
 * `published/`'s contract is that absence is the signal and the reason sits
 * beside it. This is where the reason surfaces; without it a reader sees an
 * empty section and nothing saying why.
 *
 * **IT NO LONGER RENDERS CAVEATS, AND MUST NOT LEARN HOW AGAIN.** The load
 * grader's caveats qualify data that IS there -- a carried-forward baseline, a
 * week that has not started, a derived cadence -- and every one of them is
 * either an expected state or something to go and fix. The athlete, 2026-08-14,
 * reading three of them above a week: *"all of the warnings at the top of the
 * page are expected... we already worked to remove these in a previous update
 * with instructions for you to bring up things like that with me in
 * conversation and not display them on the page."* That is the same instruction
 * that took the adherence grader's `warnings` off the page on 2026-08-10, and
 * caveats should have gone with them. `grade_load.py` still prints every one to
 * stderr; that is the channel now, and `caveats` has left the payload.
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
    </>
  );
}
