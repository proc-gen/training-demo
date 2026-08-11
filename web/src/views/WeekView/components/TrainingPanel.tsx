"use client";

import type { Week } from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { Table } from "@/lib/ux/primitives/Table";
import { weekFacts } from "../data/facts";
import { prescriptionById, runsWithDuration, sortedRuns } from "../data/runs";
import { DurationTable } from "./DurationTable";
import { RunRow } from "./RunRow";
import { RunTotals } from "./RunTotals";

/** Every run in the week, with its prescription beside its execution.
 *
 * The week's totals sit at the head of it since 2026-08-10. They were under the
 * score bars, which read as though mileage were part of the grade; they are
 * facts about these runs and they belong above them.
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
  const byId = prescriptionById(week);
  const runs = sortedRuns(a);
  const withDuration = runsWithDuration(a);
  const facts = weekFacts(a);

  return (
    <>
      {facts ? <RunTotals facts={facts} /> : null}
      <Table
        headers={[
          { label: "Day" },
          { label: "Role" },
          { label: "Prescribed" },
          { label: "Miles", num: true },
          { label: "Time", num: true },
          { label: "Pace", num: true },
          { label: "HR avg/max", num: true },
          { label: "Ceiling", num: true },
          { label: "Score", num: true },
        ]}
      >
        {runs.map((r, i) => (
          <RunRow
            key={i}
            r={r}
            prescribed={byId.get(r.id) || r.prescribed || ""}
            chart={week.pace_chart}
          />
        ))}
      </Table>
      <Note>Rows with detected reps expand — click one for its rep table.</Note>

      {withDuration.length ? <DurationTable runs={withDuration} /> : null}
    </>
  );
}
