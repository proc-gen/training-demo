/* The runs table's summation row.
 *
 * NOTHING HERE RE-DERIVES A SCORE, and one cell in particular is NOT a sum of
 * the column above it -- see `miles` below. This sorts and formats published
 * numbers, the same rule `losses.ts` and `facts.ts` carry.
 */

import { clock, num, pace } from "@/lib/data/format";
import type { RunResult, Week } from "@/lib/data/payload";
import type { WeekFacts } from "./facts";
import type { TrimpRow } from "./trimp";

export type RunTotalsRowData = {
  miles: string;
  seconds: string;
  pace: string;
  trimp: string;
  /** The week's own score, 0-100, or null. 0 IS A REAL VALUE and must render. */
  pct: number | null;
  /** What the row does NOT sum, said out loud. Never a silent truncation. */
  note: string;
};

/** The summation row's cells.
 *
 * **MILES AND TIME COME FROM `facts`, NOT FROM RE-SUMMING THE COLUMN.** The
 * table lists every activity including walks and hikes; `week_facts` excludes
 * them via `is_run`, because they are mechanical load rather than running
 * volume. Re-summing here would need `NON_RUN_ROLES` copied into TypeScript --
 * the drift `roll_up`'s `score_bucket` exists to prevent -- and it would print a
 * volume that disagreed with the Volume line inside the very row that stated it.
 *
 * **THE SCORE IS NOT A SUM EITHER**, and cannot be: `roll_up` is a ratio of
 * summed seconds, not a mean of the percentages above. Stating that in the note
 * is what stops the row reading as broken arithmetic.
 *
 * **TRIMP IS A GENUINE COLUMN SUM** -- of published per-activity measurements,
 * which is arithmetic rather than derivation.
 */
export function runTotals(
  week: Week,
  facts: WeekFacts | null,
  runs: RunResult[],
  trimp: Map<string, TrimpRow>,
): RunTotalsRowData | null {
  if (!facts) return null;

  // Sessions that were DUE and never recorded. They are charged to the week's
  // Adherence score and are deliberately not in this row -- see `pct` below.
  const charged = runs.filter((r) => r.status === "missed").length;

  const priced = runs
    .map((r) => trimp.get(String(r.id))?.trimp)
    .filter((v): v is number => v !== null && v !== undefined);
  const unpriced = runs.length - priced.length;
  const estimated = runs.filter(
    (r) => trimp.get(String(r.id))?.source === "average-hr",
  ).length;

  // The running-only caveat is stated on EVERY week rather than only where a
  // walk happens to appear. A reader who never sees it cannot know it applied,
  // and its absence would itself become a signal nobody was told to read.
  const bits = [
    "Volume and time are the week's RUNNING totals, so a walk or hike in the " +
      "table above is not counted in them.",
    "The score is a ratio of summed seconds, not an average of the column.",
  ];
  if (unpriced)
    bits.push(
      `${unpriced} activit${unpriced === 1 ? "y" : "ies"} had no TRIMP row and ` +
        "is not in that sum.",
    );
  if (estimated)
    bits.push(
      `${estimated} marked ≈ was priced from an average heart rate rather than ` +
        "the per-second stream, which understates by about 3%.",
    );
  // NO SILENT TRUNCATION, again. A hill-sprint file is eight minutes of wall
  // clock for twenty seconds of running, and the week's totals count only the
  // running -- but the row above still shows the file's own duration, because
  // that is how long the athlete was out. Without this line the two disagree
  // with nothing to explain it.
  const walked = facts.walk_recovery_seconds ?? 0;
  const walkRuns = facts.walk_recovery_runs ?? 0;
  if (walked > 0)
    bits.push(
      `${clock(walked)} of walking recovery on ${walkRuns} session` +
        `${walkRuns === 1 ? "" : "s"} is in the row above but not in the ` +
        "totals; the prescription recovers by walking and these are running " +
        "totals.",
    );
  // NO SILENT TRUNCATION. Without this the row reads as a complete account of
  // the week and quietly differs from the Adherence meter above it.
  if (charged)
    bits.push(
      `${charged} session${charged === 1 ? " was" : "s were"} due and not ` +
        "recorded; they cost the week's Adherence score and are not in this row.",
    );

  return {
    miles: num(facts.miles, 2),
    seconds: clock(facts.seconds),
    // Derived from the two facts beside it, not from the pace column -- an
    // average of per-run paces is not the week's pace.
    pace:
      facts.miles && facts.seconds ? pace(facts.seconds / facts.miles) : "--",
    trimp: priced.length ? num(priced.reduce((a, b) => a + b, 0), 0) : "--",
    // `recorded`, NOT `week`. Every other cell in this row is a measurement of
    // what was run, and `week` charges the sessions that were not -- so the row
    // read 35% under four rows averaging 99. The two now differ visibly and
    // with a stated reason, in the note above. `week` is untouched and still
    // drives the Adherence meter, where the misses are itemised in its ledger.
    pct: week.adherence?.scores?.recorded?.pct ?? null,
    note: bits.join(" "),
  };
}
