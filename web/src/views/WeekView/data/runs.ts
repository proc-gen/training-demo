/* Which runs to show, and in what order.
 *
 * Extracted from the runs card so the filter below can be tested in the node
 * project. It is one line, and it was wrong for a week.
 */

import type { Adherence, RunResult, Week } from "@/lib/data/payload";

/** The week's runs, by date and then by activity id.
 *
 * Id second because a double is two files on one date, and the order they were
 * recorded in is the order they were run in.
 */
export function sortedRuns(adherence: Adherence): RunResult[] {
  return [...adherence.results].sort((x, y) =>
    x.date === y.date
      ? Number(x.id) - Number(y.id)
      : (x.date ?? "") < (y.date ?? "")
        ? -1
        : 1,
  );
}

/** The runs that were scored against a prescribed duration.
 *
 * 0.0 IS A REAL VALUE -- it means the run landed exactly inside its
 * prescription, which is the best possible outcome. The original filter was a
 * truthiness check on `pct`, so those runs were dropped and the section listed
 * only misses. Found on the first week ever authored with `prescribed_seconds`:
 * three of five runs showed, and the two missing were the two that were bang on.
 */
export function runsWithDuration(adherence: Adherence): RunResult[] {
  return adherence.results.filter(
    (r) => r.duration && r.duration.pct !== null && r.duration.pct !== undefined,
  );
}

/** Activity id -> the manifest's prescription string for it.
 *
 * The manifest is the source for what was ASKED FOR; the grader's own
 * `prescribed` is the fallback.
 */
export function prescriptionById(week: Week): Map<unknown, string> {
  const byId = new Map<unknown, string>();
  const runs = (week.manifest as { runs?: { id: unknown; prescribed?: string }[] })
    ?.runs;
  for (const r of runs ?? []) byId.set(r.id, r.prescribed ?? "");
  return byId;
}
