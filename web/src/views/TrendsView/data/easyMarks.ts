/* What was actually RUN ON THE EASY DAYS, for the target-paces panel to draw
 * against the zones.
 *
 * `workoutMarks` covers the sessions built out of reps and `raceMarks` covers
 * the races. This is the rest of the week -- and it is most of it: 428 runs on
 * record against 90 marked workouts and 10 races. The Easy / recovery group was
 * the one group carrying a band with nothing plotted against it, so the zones
 * the athlete spends the bulk of their time inside were drawn as a plan nobody
 * could see the execution of.
 *
 * ITS OWN MODULE, the `raceMarks` precedent. It is a different DERIVATION, not a
 * variant of `workoutMarks`': there are no sets to group, no rep pool to average
 * and no belt list to split -- a continuous run's pace is the run's own average,
 * which the grader already computed and the Week tab's runs table already shows.
 * Measured over the committed tree: none of these runs carries `detail.sets` and
 * every one carries a `volume_source` of `file`, so there is no second candidate
 * for "what did this run average".
 *
 * IT KNOWS NOTHING ABOUT ZONES, the rule `workoutMarks`' header states and the
 * thing that keeps the two modules out of a cycle with `paceSeries.ts`. It
 * reports the ROLE; which series a role is drawn on -- including the athlete's
 * ruling that a long run wears Easy's colour -- is `paceSeries`' vocabulary.
 */

import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";

/** The roles drawn here.
 *
 * The athlete's scope, 2026-08-26: *"all easy/recovery/long runs"*. The other
 * two CONTINUOUS_ROLES are deliberately out and for different reasons --
 * `tempo` has a band and one run on record, `progression` has no zone at all
 * because it is judged on getting faster rather than on staying in a range.
 *
 * `volume_only` is the one most likely to creep in and must not: a workout's
 * separately-recorded warmup is 139 rows of running that was never prescribed a
 * pace, and plotted against the easy band it would read as a slow easy day.
 */
export const EASY_ROLES = ["easy", "recovery", "long"] as const;

/** One of the three, as a TYPE.
 *
 * Narrowed here rather than carried as a bare `string`, because `PanelMark.kind`
 * is a union and a mark's `kind` IS this role -- so the alternative was an `as`
 * cast at the one place the two meet, which is the compiler being told to stop
 * checking exactly where the guarantee lives.
 */
export type EasyRole = (typeof EASY_ROLES)[number];

const isEasyRole = (role: unknown): role is EasyRole =>
  typeof role === "string" && (EASY_ROLES as readonly string[]).includes(role);

/** The declared-distance tier, verbatim off the run record.
 *
 * `apply_treadmill_distance` in `grade_week.py` stamps this when it has rewritten
 * a run's distance and average pace from the belt, which it can only do when the
 * declaration describes the WHOLE run.
 */
const BELT = "treadmill-declared";

/** One completed continuous run: what it averaged, and how we know.
 *
 * `role` rather than a series key -- see the header. `miles` is the tooltip's
 * provenance line, the job `RaceMark.totalMi` does on a race dot: a dot on the
 * easy band says nothing about whether it was three miles or thirteen.
 */
export type EasyMark = {
  date: string;
  /** `easy`, `recovery` or `long`. The CALLER maps this to a series. */
  role: EasyRole;
  /** Seconds per mile -- the run's own average, which is the number the Week
   *  tab's runs table shows for the same run. */
  value: number;
  miles: number | null;
  /** The pace came from the BELT rather than the watch.
   *
   * NAMED, the tier rule `run_step_source` and TRIMP's three tiers follow. Both
   * are measurements here -- the belt is the only honest reading of an indoor
   * pace, and the watch under-records by roughly 15% on this setup -- so the
   * label is provenance rather than a warning. 36 runs on record. */
  belt: boolean;
};

/** Every completed easy, recovery and long run, oldest week first.
 *
 * IT READS `results` AND NEVER `planned`, the shape both sibling modules have: a
 * session that has not happened has no measured pace, so a forward-authored
 * manifest contributes nothing by construction rather than by a filter.
 *
 * A RUN WITH NO PACE EMITS NOTHING -- reported in conversation, never as a dot at
 * some default. The test is on a finite POSITIVE number rather than on
 * truthiness: `0` is not a pace, and the falsy-zero trap is one this repo has
 * paid for.
 */
export function easyMarks(payload: Payload): EasyMark[] {
  const out: EasyMark[] = [];
  for (const k of weekKeys(payload)) {
    for (const run of payload.weeks[k]?.adherence?.results ?? []) {
      const date = run.date;
      if (typeof date !== "string" || !date) continue;
      const role = run.role;
      if (!isEasyRole(role)) continue;
      const pace = run.pace;
      if (typeof pace !== "number" || !Number.isFinite(pace) || pace <= 0) continue;
      const miles = run.miles;
      out.push({
        date,
        role,
        value: pace,
        miles:
          typeof miles === "number" && Number.isFinite(miles) && miles > 0
            ? miles
            : null,
        belt: run.distance_source === BELT,
      });
    }
  }
  return out;
}
