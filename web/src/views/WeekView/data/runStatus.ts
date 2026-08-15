/* What a row in the runs table IS.
 *
 * **THE GRADER DECIDES THIS, NOT THE PAGE.** `status` arrives on every result
 * already resolved — `completed`, `missed` or `pending` — because Python knows
 * the evaluation cutoff and the page does not. That is a change from the first
 * version of this file, which compared the run's date against a `today` read in
 * the browser: the answer has to agree with the date the SCORE was computed
 * against, and two independent clocks cannot promise that. A row reading
 * *Not yet completed* beside a score that had already charged it as missed is
 * exactly the disagreement a second clock invites.
 *
 * It also removed the hook that supplied `today` (`useToday`), and with it the
 * static-export caveat that motivated it.
 */

import type { RunResult } from "@/lib/data/payload";

export type RunStatus =
  /** A measurement exists for this row. */
  | "completed"
  /** Planned, and its DAY IS OVER with nothing recorded on it. It costs the
   *  week whatever the plan priced it at. */
  | "missed"
  /** Planned, and its day has not finished — today's session included. There is
   *  time to do it, and it costs nothing. */
  | "pending";

/** The published `status`, narrowed, with a safe reading for older records.
 *
 * A record written before 2026-08-12 carries no `status` at all, and every run
 * in one is a run that happened — so anything unrecognised reads as completed
 * rather than inventing a miss on a week that was graded whole.
 */
export function runStatus(run: Pick<RunResult, "status">): RunStatus {
  return run.status === "missed" || run.status === "pending"
    ? run.status
    : "completed";
}

/** The words the table shows.
 *
 * `pending` reads *Not yet completed* rather than "pending" because that is the
 * athlete's own phrase for it, and it says the thing that matters: the session
 * is still theirs to do.
 *
 * **THE TWO DIVERGED ON 2026-08-13**, when a miss started meaning "the day is
 * over and nothing recorded it" rather than "the athlete has not got to it
 * yet". One of these rows costs the week points and the other costs nothing,
 * and printing the same words on both is the page declining to say which.
 */
export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  completed: "",
  missed: "Missed",
  pending: "Not yet completed",
};

/** Whether this row has measurements behind it. */
export function isPlanned(run: Pick<RunResult, "status">): boolean {
  return runStatus(run) !== "completed";
}
