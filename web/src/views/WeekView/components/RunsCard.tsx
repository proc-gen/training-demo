"use client";

import type { Week } from "@/lib/data/payload";
import { Banner } from "@/lib/ux/primitives/Banner";
import { Card } from "@/lib/ux/primitives/Card";
import { Note } from "@/lib/ux/primitives/Note";
import { Table } from "@/lib/ux/primitives/Table";
import { prescriptionById, runsWithDuration, sortedRuns } from "../data/runs";
import { DurationTable } from "./DurationTable";
import { RunRow } from "./RunRow";

/** Every run in the week, with its prescription beside its execution. */
export function RunsCard({ week }: { week: Week }) {
  const a = week.adherence!;
  const byId = prescriptionById(week);
  const runs = sortedRuns(a);
  const withDuration = runsWithDuration(a);

  return (
    <Card title="Runs">
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

      {(a.warnings ?? []).map((x, i) => (
        <Banner key={i}>{x.text}</Banner>
      ))}
    </Card>
  );
}
