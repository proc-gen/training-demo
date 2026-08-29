/* What was actually RACED, for the race-times panel to draw against the
 * prognoses.
 *
 * The panel has always drawn the plan's side -- each week's projected race
 * times off the confirmed chart. This is the other half: one mark per graded
 * race, at the clock and pace the grader measured, so the projection and the
 * effort sit on one plot.
 *
 * **RACES DO NOT ATTACH TO A SERIES.** The athlete's ruling, 2026-08-26:
 * *"races don't go on lines. they should just get points on the chart."* A
 * race is one effort on one day -- Mountain has no distance the panel
 * plots and the mile was prognosed exactly once -- so a mark here carries no
 * band and every graded race appears, in the panel's own race colour, with the
 * measured distance in its tooltip saying what it was. That is the opposite of
 * `workoutMarks`, whose dots wear the zone they were aimed at; the difference
 * is the data's: a workout targets a band, a race just happened.
 *
 * IT READS `results` AND NEVER `planned`. A planned race has no `detail.race`
 * -- nothing has been measured -- so a future race contributes nothing by
 * construction, the same shape `workoutMarks` has.
 */

import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";

/** One graded race: the clock, the pace, and the measured distance.
 *
 * BOTH QUANTITIES, because the panel's two modes are two different measurements
 * on two different scales -- the caller picks per mode, exactly as the modes'
 * own point sets do.
 */
export type RaceMark = {
  date: string;
  /** Finishing time, seconds. */
  seconds: number;
  /** Seconds per mile over the MEASURED distance. */
  pace: number;
  /** The measured distance, which is the tooltip's provenance line -- the
   *  series labels state nominal distances, and `3.09 mi` says this dot is the
   *  actual race. Null when the grader could not state one. */
  totalMi: number | null;
};

/** Every graded race, oldest week first.
 *
 * A race missing either quantity emits nothing -- reported in conversation,
 * never as a mark at some default. The test is on a finite POSITIVE number
 * rather than on truthiness: `0` is not a finishing time and not a pace, and
 * the falsy-zero trap is one this repo has paid for.
 */
export function raceMarks(payload: Payload): RaceMark[] {
  const out: RaceMark[] = [];
  for (const k of weekKeys(payload)) {
    for (const run of payload.weeks[k]?.adherence?.results ?? []) {
      const date = run.date;
      if (typeof date !== "string" || !date) continue;
      const race = run.detail?.race;
      if (!race) continue;
      const { seconds, pace, total_mi } = race;
      if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) continue;
      if (typeof pace !== "number" || !Number.isFinite(pace) || pace <= 0) continue;
      out.push({
        date,
        seconds,
        pace,
        totalMi:
          typeof total_mi === "number" && Number.isFinite(total_mi) && total_mi > 0
            ? total_mi
            : null,
      });
    }
  }
  return out;
}
