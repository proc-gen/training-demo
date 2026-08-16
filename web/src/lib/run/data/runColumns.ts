/* The runs table's columns, defined once.
 *
 * ONE DEFINITION BECAUSE TWO THINGS DEPEND ON THE COUNT. The header row renders
 * from it, and every expanded row spans it with a `colSpan`. That span was a
 * hard-coded `9` sitting in `RunRow.tsx` while the headers were a literal array
 * in `TrainingPanel.tsx` -- two places to edit, no test that could notice they
 * had diverged, and a detail panel that silently stops spanning the table the
 * moment a column is added or removed. This change does both at once, which is
 * exactly when that would have bitten.
 *
 * WHAT LEFT, AND WHY IT IS STILL PUBLISHED:
 *   - `Role` duplicated `Prescribed` -- "recovery" beside "30 min recovery" --
 *     and is still on every result, feeding the score explanation.
 *   - `Ceiling` moved INTO that explanation, where it is the criterion the
 *     arithmetic actually uses rather than a bare number in a column.
 *
 * IT LIVES IN `lib/run/` BECAUSE TWO VIEWS RENDER A RUN NOW. The Week tab's
 * runs table and the Calendar's day card show the same rows through the same
 * `RunRow`, and a view may not import a sibling view -- so the proximity rule
 * sent this whole subtree up to the shared container. Its content is unchanged
 * by the move.
 */

import type { Col } from "@/lib/ux/primitives/Table";

export const RUN_COLUMNS: Col[] = [
  { label: "Day" },
  { label: "Prescribed" },
  { label: "Miles", num: true },
  { label: "Time", num: true },
  { label: "Pace", num: true },
  { label: "HR avg/max", num: true },
  { label: "TRIMP", num: true },
  { label: "Cadence", num: true },
  { label: "Score", num: true },
];
