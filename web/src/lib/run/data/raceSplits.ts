import type { RaceDetail, RaceSplit } from "@/lib/data/payload";

/** The ±1% dead band `race_report` itself uses, so the word this file picks and
 *  the number printed beside it cannot disagree. Outside it the race was
 *  genuinely run unevenly; inside it, calling a 0.4% drift a positive split
 *  would be a verdict on rounding. */
export const EVEN_PCT = 1;

/** `mi 3` for a whole split, `3.09 mi` for the tail.
 *
 * THE COLUMN IS A MARKER, NOT A LENGTH, which is the whole reason a race split
 * is not a `Lap`: `at_mi` says where the split ENDED. Every full split is a mile
 * long and says so by its number; only the last is short, and it is labelled by
 * the distance it reached because that is the only row where the distance is
 * news. It is the CLI's own rule, kept so the page and the terminal read alike.
 */
export function splitLabel(s: RaceSplit): string {
  if (s.at_mi === null || s.at_mi === undefined) return "--";
  return s.partial ? `${s.at_mi.toFixed(2)} mi` : `mi ${s.at_mi.toFixed(0)}`;
}

/** "positive split" | "negative split" | "even", or NULL where the grader
 *  declined to state one.
 *
 * `delta_pct` is null when `first` is 0 -- the only case `race_report` guards.
 * Returning "even" there would invent a verdict out of an absence, which is the
 * vacuous-pass shape one tier out: a consumer must print the two times and
 * withhold the word.
 */
export function halvesShape(delta: number | null | undefined): string | null {
  if (delta === null || delta === undefined || !isFinite(delta)) return null;
  if (delta > EVEN_PCT) return "positive split";
  if (delta < -EVEN_PCT) return "negative split";
  return "even";
}

/** Race splits as chart marks: one point per split, pace in seconds per mile.
 *
 * A WHOLE SPLIT'S `seconds` IS ALREADY ITS PACE, because it is a mile long. The
 * tail is not, so it divides by its own `length_mi` -- without which
 * 2026-08-30's 0:31 final split would plot at 31 s/mi and squash all three real
 * miles into the top of the axis. `|| 1` rather than `?? 1` deliberately: a
 * `length_mi` of 0 is as unusable a divisor as an absent one.
 *
 * A split with no `seconds` yields a null pace rather than being dropped, so the
 * chart keeps one x slot per split and `RepChartPanel` decides what is
 * plottable -- the same contract the lap path has.
 */
export function raceChartPoints(race: RaceDetail) {
  return (race.splits ?? []).map((s) => ({
    pace:
      s.seconds === null || s.seconds === undefined
        ? null
        : s.seconds / (s.length_mi || 1),
    hr_avg: s.hr_avg,
    hr_max: s.hr_max,
  }));
}
