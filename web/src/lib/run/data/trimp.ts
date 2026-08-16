/* Per-activity TRIMP, keyed for the runs table.
 *
 * `publish.py` writes the week's rows straight out of `derived/trimp.csv` -- a
 * TRAINING-LOAD output, joined by the publisher because the adherence grader may
 * not read it. This turns that row list into a lookup and nothing else: no
 * summing, no re-pricing, no filling in a missing row.
 *
 * IT LIVES IN `lib/run/` BECAUSE TWO VIEWS RENDER A RUN NOW. The Week tab's
 * runs table and the Calendar's day card show the same rows through the same
 * `RunRow`, and a view may not import a sibling view -- so the proximity rule
 * sent this whole subtree up to the shared container. Its content is unchanged
 * by the move.
 */

import { n } from "@/lib/data/format";
import type { Week } from "@/lib/data/payload";

export type TrimpRow = {
  /** Null when the row exists but carries no value. Never 0 -- see below. */
  trimp: number | null;
  /** "stream" (measured, integrating the per-second heart rate) or
   *  "average-hr" (an ESTIMATE from one average, which understates by ~3%).
   *  The table marks the second so an estimate never reads as a measurement. */
  source: string | null;
};

/** Activity id -> its TRIMP row.
 *
 * KEYED AS A STRING on both sides. The CSV spells ids as text and a manifest
 * spells them as numbers, so `Map<number>` would miss every lookup and the whole
 * column would read `--` without anything failing.
 *
 * Values go through `n()`, which returns null for `""`. That matters: the empty
 * string is how these CSVs spell NOT MEASURED, and `Number("")` is 0 -- a zero a
 * reader cannot tell from an activity that genuinely scored nothing.
 */
export function trimpByActivity(week: Week): Map<string, TrimpRow> {
  const out = new Map<string, TrimpRow>();
  for (const row of week.trimp ?? []) {
    const id = row.activity_id;
    if (!id) continue;
    out.set(String(id), {
      trimp: n(row.trimp),
      source: row.trimp_source || null,
    });
  }
  return out;
}
