/* What was actually RUN, for the target-paces panel to draw against the zones.
 *
 * The panel has always drawn the plan -- each week's confirmed pace chart, which
 * is what the athlete was ASKED to run. This is the other half: one mark per
 * workout, at the average pace of its reps, so the executed session and the zone
 * it was aimed at sit on one plot.
 *
 * IT KNOWS NOTHING ABOUT ZONES. `paceSeries.ts` owns the vocabulary -- which
 * bands exist, which group holds them, and that `repetition` is a zone derived
 * from two race paces rather than stored on a chart. This module answers a
 * narrower question: what did each workout average, and how do we know. Keeping
 * the mapping there is what avoids a module cycle, and it is why the long-rep
 * guard below takes its threshold as an argument rather than importing it.
 *
 * ONE MARK PER DECLARED TARGET, PER RUN -- **NOT PER AUTHORED BLOCK**. A set
 * boundary is not a change of pace type; the declared TARGET is. 2026-02-05's
 * `5x6:30 -> 7:00 @ 8.9 for last rep` is authored as two sets so the odd last
 * rep can be PRICED, and both of them state `rep_band: "rep_6min"` -- so it is
 * one workout at one pace range and it gets one dot. Drawn per block it was two,
 * at 6:49 and 6:44, and the athlete found it on the chart: *"all reps were run
 * at the same pace range and one wasn't averaged in together despite being part
 * of the same workout."* 2025-04-18's `4x1200m` and `4x600m` both author
 * `rep_band: "rep_3min"`, and 2025-01-28's two blocks both author
 * `rep_pace: "3000m"`; all three are one target and merge.
 *
 * **THE GUARD RUNS PER BLOCK, BEFORE THE MERGE, AND THE ORDER IS LOAD-BEARING.**
 * 2025-02-21's `1x1600m` and `2x200m` ALSO both declare `rep_pace: "3000m"`, so
 * merging first would combine a mile with two 200s -- the exact pairing the
 * athlete separated by hand two sessions earlier. `holdsLongRep` removes the
 * mile's block while it is still its own block, and what survives then merges
 * alone. Swap the two and that dot silently becomes wrong.
 *
 * THE GROUP KEY IS `(mode, band)`, which is what the series key is built from --
 * so this stays "one dot per zone per workout" without the module ever naming a
 * zone.
 *
 * MODES ARE FILTERED PER SET, which is what delivers the athlete's stated
 * exception for free: a run carrying hill sprints and a sub-T block yields the
 * sub-T mark and ignores the sprints, because the sprints are a `neuromuscular`
 * set and this only ever looks at the two modes it is asked for. 2026-08-14 and
 * 08-21 author those as separate runs, but 2026-09-04, 09-11 and 09-18 author
 * them as ONE run with two sets -- so that has to work at set level, and it is a
 * different question from which blocks average together.
 */

import type { Payload, RepRow, RepSet, RunResult } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";

/** The modes that carry a pace zone to be drawn against.
 *
 * The athlete's scope, 2026-08-25: *"only focus on sub-t and repetition paces
 * for now."* `threshold` and `interval` exist in the record and are deliberately
 * out; `neuromuscular` is graded by nothing at all.
 */
export const MARKED_MODES = new Set(["subt", "repetition"]);

/** Seconds in an hour, for `3600 / mph` -> seconds per mile. */
const SEC_PER_HOUR = 3600;

/** One executed workout at one target: what it averaged, and how we know.
 *
 * The unit is a RUN's blocks sharing a declared target, not one authored block
 * -- see the header. `reps` is the total across them.
 */
export type WorkoutMark = {
  date: string;
  /** The set's own mode -- `subt` or `repetition`. The CALLER maps this to a
   *  series; this module never names a zone. */
  mode: string;
  /** The set's band NAME on a sub-T block (`rep_3min`), null on a repetition
   *  one, whose zone has no name in the chart. Verbatim off the payload. */
  band: string | null;
  /** Seconds per mile. */
  value: number;
  reps: number;
  /** `belt` or `reps` -- never allowed to read as the same thing.
   *
   * `belt` ONLY WHEN EVERY MERGED BLOCK WAS BELT-PRICED. It cannot currently be
   * anything else within one group: `beltSplit` is all-or-nothing across a whole
   * run, so a run's marked blocks are either all belt or all reps -- asserted
   * over the corpus by test, which is what keeps this label from quietly
   * becoming wrong if that ever stops holding. */
  source: "belt" | "reps";
};

/** The metres in a distance key or a rep label -- `"800m"`, `"200m"`, `"1609m"`.
 *
 * ONE PARSER FOR BOTH, because they are the same notation: `RACE_ORDER`'s keys
 * and `RepRow.label` are both metres with an `m` suffix, which is what lets the
 * guard below take its threshold straight from the repetition zone's own fast
 * end rather than inventing a second way to say a distance.
 */
export function metresOf(key: string | null | undefined): number | null {
  if (typeof key !== "string") return null;
  const m = /^(\d+(?:\.\d+)?)m$/.exec(key.trim());
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

/** The work reps of a block that carry a pace worth averaging.
 *
 * `suspect` reps are excluded. There are none in either mode on the record
 * today; the filter is here so a future one cannot silently move an average.
 * `0` is not a pace and neither is a negative one, so the test is on a finite
 * POSITIVE number rather than on truthiness -- the falsy-zero trap this repo has
 * paid for, applied to a quantity that genuinely cannot be zero.
 */
export function workReps(set: RepSet | null | undefined): RepRow[] {
  return (set?.rep_rows ?? []).filter(
    (x) => x.work && !x.suspect && typeof x.pace === "number" && x.pace > 0,
  );
}

/** Whether a block holds a rep too long to be the pace type it declares.
 *
 * **A GUARD, NOT A MODEL.** The athlete declined to set the boundary --
 * *"this question does not change anything. it's the job of the workout to say
 * what type it is"* -- and it never binds on a block that is what it says it is:
 * every repetition block on record is 100-600 m except four containing a mile.
 * What it catches is a single authored block holding two pace types at once,
 * `2x(1xmile w/ 200m jog, 3x200m w/ 200m jog)`, where the manifest states one
 * set and the reps are not one thing. *"A 1600m is obviously not going to be run
 * at repetition pace outside of an actual race."*
 *
 * THE THRESHOLD IS THE ZONE'S OWN FAST END and therefore no new constant: the
 * repetition band IS 800 m race pace to 3000 m race pace, so a rep as long as
 * the shortest race it is built from is a race effort. The caller passes it, and
 * it is `REPETITION.fast` -- already duplicated from
 * `scripts/training-adherence/model.json` and machine-checked by
 * `tests/test_pace_group_constants.py`.
 *
 * WHOLE-BLOCK, NEVER PER REP. Dropping the miles and averaging the surviving
 * 200s was offered and declined: a mark built from a block with a quarter of its
 * reps removed is not that block's average.
 *
 * The label is preferred over `dist_km` because it is the length the rep was
 * JUDGED as -- the snapped distance, the same one the score and the rep chart
 * use. `dist_km` answers for a rep the grader could not snap.
 */
export function holdsLongRep(rows: RepRow[], longRepMetres: number | null): boolean {
  if (longRepMetres === null) return false;
  return rows.some((x) => {
    const labelled = metresOf(x.label);
    if (labelled !== null) return labelled >= longRepMetres;
    const km = x.dist_km;
    return typeof km === "number" && km * 1000 >= longRepMetres;
  });
}

/** The belt speeds of each set of one run, or an empty map.
 *
 * **THE LIST SPANS THE WHOLE RUN**, `reps[i]` being the i-th rep of the session,
 * so it is split across the run's sets by their prescribed counts -- and ONLY
 * when every set states a scalar count and those counts sum exactly to the
 * list's length. Anything else returns nothing: that is the all-or-nothing shape
 * `treadmill_mph` already has in the grader, where a count mismatch overrides
 * NOTHING, and the reason is the same -- a partial split publishes a pace that
 * is neither instrument's.
 *
 * One run needs the split today: 2026-02-05's `5x6:30 -> 7:00 @ 8.9 for last
 * rep`, authored as 4 + 1 against five speeds.
 */
export function beltSplit(run: RunResult): Map<number, number[]> {
  const out = new Map<number, number[]>();
  const speeds = run.treadmill_mph?.reps;
  const sets = run.detail?.sets ?? [];
  if (!Array.isArray(speeds) || !speeds.length || !sets.length) return out;
  if (!speeds.every((v) => typeof v === "number" && v > 0)) return out;

  const counts: number[] = [];
  for (const s of sets) {
    const c = s.prescribed_reps;
    // A RANGE STATES NO COUNT. `8-10x600m` is a real prescription and arrives
    // as `[8, 10]`; there is no honest way to slice a speed list against it.
    if (typeof c !== "number" || !Number.isInteger(c) || c < 0) return out;
    counts.push(c);
  }
  if (counts.reduce((a, b) => a + b, 0) !== speeds.length) return out;

  let at = 0;
  counts.forEach((c, i) => {
    if (c > 0) out.set(i, speeds.slice(at, at + c));
    at += c;
  });
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Every executed workout worth drawing, oldest week first.
 *
 * ONE MARK PER `(run, mode, band)` -- see the header for why that is the unit
 * and why the guard has to run before the grouping.
 *
 * TWO ROUTES TO A PACE, AND THE BELT WINS WHERE IT WAS AUTHORED.
 *
 *   `belt`  `3600 / mph`, from the run's own `treadmill_mph`. Not a fallback
 *           estimate -- the belt speed is the only measurement of an indoor
 *           session's pace and the watch's is an artifact. The list also records
 *           what ACTUALLY ran, so 2026-02-26's `6x5:30 -> Noped after 1 rep`
 *           carries one speed and reports one rep.
 *   `reps`  the mean of `rep_rows[].pace`, which is the pace the score and the
 *           rep chart already use.
 *
 * **PREFERRING THE BELT CHANGES NO EXISTING NUMBER, MEASURED.** Across the 19
 * runs where both routes exist the two agree to the decimal and the rep counts
 * match exactly -- because `grade_week` already substitutes belt speed into each
 * rep's pace when the counts line up, so `rep_rows[].pace` IS the belt there.
 * What preferring it adds is the case the grader refuses: a rep-count mismatch
 * overrides nothing, which is why the whole Dec-Mar treadmill block reports
 * `detected rep count disagrees with the prescription` and measured nothing at
 * all. Fourteen sessions come back. `workoutMarks.test.ts` asserts the agreement
 * over the committed tree, in both directions.
 *
 * A block with neither route emits nothing -- reported in conversation, never as
 * a mark at some default.
 */
export function workoutMarks(
  payload: Payload,
  longRepMetres: number | null,
): WorkoutMark[] {
  const out: WorkoutMark[] = [];
  for (const k of weekKeys(payload)) {
    for (const run of payload.weeks[k]?.adherence?.results ?? []) {
      const date = run.date;
      if (typeof date !== "string" || !date) continue;
      const belt = beltSplit(run);

      /* GROUPED WITHIN THE RUN, which is what makes a run the merge unit
         without needing an identifier for one -- a `key` is unique inside a
         WEEK only, so a map spanning weeks would need the week in it too.
         Insertion-ordered, so the output stays in authored set order and is
         deterministic. */
      const groups = new Map<
        string,
        { mode: string; band: string | null; paces: number[]; belt: boolean }
      >();

      (run.detail?.sets ?? []).forEach((set, i) => {
        const mode = set.mode;
        if (typeof mode !== "string" || !MARKED_MODES.has(mode)) return;
        const rows = workReps(set);
        /* THE GUARD, PER BLOCK AND BEFORE THE GROUPING. 2025-02-21's mile and
           its 200s declare the SAME target, so grouping first would merge them
           -- see the header. It runs against the rep rows whichever route
           prices the block, so a treadmill session cannot slip a mile past it
           by having its paces come from elsewhere. */
        if (mode === "repetition" && holdsLongRep(rows, longRepMetres)) return;

        const speeds = belt.get(i);
        const paces = speeds
          ? speeds.map((mph) => SEC_PER_HOUR / mph)
          : rows.map((x) => x.pace as number);
        if (!paces.length) return;

        const band = typeof set.band === "string" ? set.band : null;
        // `\0` cannot occur in either part, so the key is unambiguous
        // where a `-` would let `rep_3` + `min` collide with `rep` + `3min`.
        const at = `${mode}\0${band ?? ""}`;
        const group = groups.get(at);
        if (group) {
          /* EVERY PACE JOINS ONE POOL, so the mean is over all the reps and
             never a mean of block means: 2026-02-05's groups are four reps and
             one, and averaging the two averages would weight that single rep
             four times over. */
          group.paces.push(...paces);
          group.belt = group.belt && Boolean(speeds);
        } else {
          groups.set(at, { mode, band, paces, belt: Boolean(speeds) });
        }
      });

      for (const g of groups.values()) {
        out.push({
          date,
          mode: g.mode,
          band: g.band,
          value: mean(g.paces),
          reps: g.paces.length,
          source: g.belt ? "belt" : "reps",
        });
      }
    }
  }
  return out;
}
