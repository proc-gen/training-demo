/* Whether a Plan cell is behind the athlete: the checkmark's whole rule.
 *
 * ==========================================================================
 * IT IS A DISPLAY MARK AND IT MUST NEVER BECOME A STATUS.
 *
 * A run's `completed` / `missed` / `pending` is stamped by the GRADER, which
 * knows the cutoff the score was computed against -- `lib/run/data/runStatus`
 * records that a `useToday` hook supplying a browser clock was DELETED for
 * exactly this reason, because two independent clocks cannot promise to agree.
 * Nothing here feeds a score, a denominator or a label on a run row. It says
 * one thing: this square of the grid is in the past.
 *
 * SO `today` ARRIVES AS AN ARGUMENT AND IS NEVER READ HERE. The clock is read
 * once, on the SERVER, in `app/calendar/page.tsx`, and threaded down -- which
 * keeps this function pure and every case assertable against a fixed date
 * instead of against the day the suite happens to run. `window.ts` makes the
 * same choice about the window's anchor for the same reason.
 * ==========================================================================
 *
 * TODAY COUNTS AS DONE. The athlete's own boundary -- "the current day or in
 * the past" -- and it is deliberately a day wider than the graders' own
 * `settled_cutoff` (`min(today - 1, week_end)`), which is what decides whether
 * a missed session is CHARGED. The two answer different questions: one asks
 * "may this be judged yet", this one asks "have I got there".
 *
 * AN UNSTATED DAY IS NEVER MARKED. A date the manifest does not mention is
 * `unstated` -- a real and different fact both graders report separately from
 * rest -- so a checkmark on it would claim the plan asked for nothing and got
 * it. `restDates` and `runsByDate` are what answer `planned`; nothing is
 * inferred from an empty cell, the rule `restDates` itself carries.
 *
 * EVERY DATE IS STRING SURGERY. ISO dates sort lexicographically, so `<=` is
 * the comparison -- and constructing a `Date` here would reintroduce the UTC
 * midnight trap `weekDates.ts` states at length for no gain at all.
 */

/** Whether the Plan grid should mark this date as done.
 *
 * `today` is nullable so a caller with no date to offer -- a test, a build that
 * declined to read a clock -- marks NOTHING rather than marking everything.
 */
export function isDone(
  date: string,
  today: string | null,
  planned: boolean,
): boolean {
  return planned && !!today && date <= today;
}
