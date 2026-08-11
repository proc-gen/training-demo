/* The five score bars, as data.
 *
 * They were five hand-written `<Meter>` calls with a label and a payload path
 * each. That was fine while the bars only had to draw; it stopped being fine
 * when each one had to open a detail panel, because the label, the number, the
 * ledger and the flag map all have to agree on WHICH component is being talked
 * about, and five string literals repeated across four files do not agree for
 * long.
 *
 * `basis` says what the ratio counts. It is prose, not a formula -- the numbers
 * come from the payload and nothing here recomputes one.
 */

import type { Week } from "@/lib/data/payload";

export type ScoreComponent = {
  /** Stable key. Matches the values in FLAG_COMPONENT and the ledger switch. */
  key: string;
  label: string;
  /** Which grader produced it. A component whose half did not grade is not
   *  rendered at all -- there is no placeholder bar, the same way there is no
   *  placeholder card. */
  half: "adherence" | "load";
  /** 0-100, or null/undefined when the grader produced no figure. */
  score: (week: Week) => number | null | undefined;
  /** One sentence naming what the ratio counts, shown above the ledger. */
  basis: string;
};

export const SCORE_COMPONENTS: ScoreComponent[] = [
  {
    key: "easy",
    label: "Easy discipline",
    half: "adherence",
    score: (w) => w.adherence?.scores?.easy?.pct,
    basis:
      "One second of credit per second of continuous running at or below the " +
      "day's heart-rate ceiling, scaled by how close the run came to its " +
      "prescribed duration. A ratio of seconds, so a long run counts for more " +
      "than a recovery jog.",
  },
  {
    key: "workout",
    label: "Workout execution",
    half: "adherence",
    score: (w) => w.adherence?.scores?.workout?.pct,
    basis:
      "The same ratio over quality sessions: rep seconds inside the prescribed " +
      "band or under the rep ceiling, against the seconds that were judgeable. " +
      "A rep that could not be judged leaves the denominator rather than failing.",
  },
  {
    key: "structure",
    label: "Structure",
    half: "adherence",
    score: (w) => w.adherence?.structure?.pct,
    basis:
      "The fraction of the week's applicable shape checks that passed. A check " +
      "that does not apply leaves the denominator -- it is neither a pass nor a " +
      "fail.",
  },
  {
    key: "integrity",
    label: "Load integrity",
    half: "load",
    score: (w) => (w.load?.integrity as { pct?: number } | undefined)?.pct,
    basis:
      "Step-equivalents at or below each day's derived ceiling, against the " +
      "step-equivalents actually accumulated. Running and everything between " +
      "the runs. A day the plan did not fully price leaves both sides.",
  },
  {
    key: "readiness",
    label: "Readiness",
    half: "load",
    score: (w) => w.load?.readiness?.pct,
    basis:
      "The fraction of available sleep, HRV and resting-heart-rate checks that " +
      "passed across the week. A metric that was not measured on a day shrinks " +
      "the denominator instead of failing.",
  },
];

/** The components whose grader produced something for this week. */
export function componentsFor(week: Week): ScoreComponent[] {
  return SCORE_COMPONENTS.filter((c) =>
    c.half === "adherence" ? !!week.adherence : !!week.load,
  );
}

/** One component by key, or undefined. */
export function componentByKey(key: string | null): ScoreComponent | undefined {
  return SCORE_COMPONENTS.find((c) => c.key === key);
}
