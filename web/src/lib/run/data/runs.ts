/* Which runs to show, and in what order.
 *
 * Extracted from the runs card so the filter below can be tested in the node
 * project. It is one line, and it was wrong for a week.
 *
 * IT LIVES IN `lib/run/` BECAUSE TWO VIEWS RENDER A RUN NOW. The Week tab's
 * runs table and the Calendar's day card show the same rows through the same
 * `RunRow`, and a view may not import a sibling view -- so the proximity rule
 * sent this whole subtree up to the shared container. Its content is unchanged
 * by the move.
 */

import type { Adherence, RunResult, Week } from "@/lib/data/payload";

/** The week's runs -- COMPLETED AND PLANNED TOGETHER -- by date, then ordinal.
 *
 * The grader keeps them in two lists so a planned run cannot reach a
 * measurement: `week_facts`, `structure_score` and `evaluate_flags` read only
 * `results`. That separation is a scoring concern, not a reading one -- the
 * athlete plans a week and then runs it, so the table shows one week in order
 * and says which rows are still ahead.
 *
 * ORDINAL, NOT THE RUNALYZE ID. This sorted on `Number(x.id)` until 2026-08-12,
 * which worked because Runalyze ids rise with time -- an accident of the source,
 * and one a planned run cannot take part in at all: it has no id, so every
 * planned row would have sorted as `NaN`. `ordinal` is the run's position within
 * its date, stamped by the grader from manifest order, which is the one
 * statement about sequence the plan actually makes.
 */
export function sortedRuns(adherence: Adherence): RunResult[] {
  return [...adherence.results, ...adherence.planned].sort((x, y) =>
    x.date === y.date
      ? (x.ordinal ?? 0) - (y.ordinal ?? 0)
      : (x.date ?? "") < (y.date ?? "")
        ? -1
        : 1,
  );
}

/** True on the first run of each date, false on the rest of that date's runs.
 *
 * A day with four activities printed `Tue 8/4` four times, which reads as four
 * separate days until the eye catches the repetition. Showing it once makes the
 * doubles and the warmup/cooldown files visibly belong to one day.
 *
 * IT DEPENDS ON THE ORDER, so it lives beside `sortedRuns`, which decides that
 * order. Run it over anything else and it marks a break every time the date
 * changes, which on unsorted input is most rows.
 */
export function dayBreaks(runs: RunResult[]): boolean[] {
  let prev: string | null = null;
  return runs.map((r) => {
    const d = r.date ?? "";
    const first = d !== prev;
    prev = d;
    return first;
  });
}

/* `runsWithDuration()` was here until 2026-08-11 and is gone with the
 * `Duration against prescription` table it fed. Its lesson moved WITH it, into
 * `runWhy.ts` where the same guard now lives: 0.0 IS A REAL VALUE -- it means
 * the run landed exactly inside its prescription, which is the best possible
 * outcome -- and the original filter here was a truthiness check on `pct`, so
 * the two runs that were bang on were the two that did not show. Every guard in
 * `runWhy` is an explicit null test for that reason. */

/** Run key -> the manifest's prescription string for it.
 *
 * The manifest is the source for what was ASKED FOR; the grader's own
 * `prescribed` is the fallback.
 *
 * KEYED ON OUR `key`, not on the Runalyze id, which is what made this work for
 * a planned run at all: the row exists in the manifest before any activity does,
 * so an id-keyed lookup would find nothing for exactly the rows whose only
 * content IS the prescription.
 */
export function prescriptionByKey(week: Week): Map<string, string> {
  const byKey = new Map<string, string>();
  const runs = (week.manifest as { runs?: { key?: string; prescribed?: string }[] })
    ?.runs;
  for (const r of runs ?? []) {
    if (r.key) byKey.set(r.key, r.prescribed ?? "");
  }
  return byKey;
}
