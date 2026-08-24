"use client";

import type { Week } from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { Table } from "@/lib/ux/primitives/Table";
import { judgedFacts, weekFacts } from "../data/facts";
import { RUN_COLUMNS } from "@/lib/run/data/runColumns";
import { dayBreaks, prescriptionByKey, sortedRuns } from "@/lib/run/data/runs";
import { runTotals } from "../data/runTotals";
import { trimpByActivity } from "@/lib/run/data/trimp";
import { RunRow } from "@/lib/run/RunRow";
import { RunTotalsRow } from "./RunTotalsRow";

/** Every run in the week, with its prescription beside its execution.
 *
 * ONE TABLE, ENDING IN ITS OWN TOTALS. The week's volume, long run and
 * easy/quality split were a block ABOVE this table until 2026-08-11, where they
 * read as a header; they are the sum of the rows and belong at the foot, in the
 * same columns. The `Duration against prescription` table that used to sit below
 * went at the same time -- a verdict about one run belongs inside that run,
 * where the reader is already looking, not in a second table they have to
 * cross-reference by date.
 *
 * IT CARRIES NO GRADER WARNINGS, and the payload no longer carries them either.
 * `!!` notices sat at the foot of this table -- unmerged auto-laps, slivers, a
 * treadmill speed count that did not match. The athlete's reading: every one so
 * far has come from a gap in the data or a session type the skill has not been
 * built for yet, which is something to RAISE WHILE GRADING and not to leave on
 * a page that gets read weeks later. `data_warnings()` still exists and
 * `grade_week.py` still prints every one of them; `jsonable()` stopped
 * publishing them, because the block below was the only consumer they had.
 */
export function TrainingPanel({ week }: { week: Week }) {
  const a = week.adherence!;
  const byKey = prescriptionByKey(week);
  // COMPLETED AND PLANNED IN ONE TABLE, in the order the week runs. The grader
  // keeps them in two lists so a planned run cannot reach a measurement; that
  // is a scoring concern, and the athlete plans a week and then runs it.
  const runs = sortedRuns(a);
  const breaks = dayBreaks(runs);
  const facts = weekFacts(a);
  const judged = judgedFacts(a);
  const trimp = trimpByActivity(week);
  const totals = runTotals(week, facts, runs, trimp);

  return (
    <>
      <Table headers={RUN_COLUMNS}>
        {runs.map((r, i) => (
          <RunRow
            key={r.key ?? i}
            r={r}
            prescribed={(r.key ? byKey.get(r.key) : "") || r.prescribed || ""}
            chart={week.pace_chart}
            showDay={breaks[i]}
            // Keyed on the RUNALYZE id: TRIMP is priced per activity, so a
            // planned row has none by construction and correctly gets nothing.
            trimp={
              r.runalyze_id === null || r.runalyze_id === undefined
                ? undefined
                : trimp.get(String(r.runalyze_id))
            }
          />
        ))}
        {totals && facts ? (
          <RunTotalsRow totals={totals} facts={facts} judged={judged ?? facts} />
        ) : null}
      </Table>
      <Note>
        Click any row for its laps, its duration against the plan, and why it
        scored what it scored. A run that has not happened yet shows what was
        prescribed — its target pace and heart-rate ceiling.
      </Note>
    </>
  );
}
