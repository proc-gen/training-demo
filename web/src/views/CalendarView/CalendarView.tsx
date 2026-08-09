"use client";

import type { Payload } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { Legend } from "@/lib/ux/primitives/Legend";
import { Note } from "@/lib/ux/primitives/Note";
import { CalendarGrid } from "./components/CalendarGrid";
import { DayTable } from "./components/DayTable";
import { calendarDays, dayByDate, loadByDate, maxSteps } from "./data/days";
import { calendarRows } from "./data/grid";

/** Daily load, every day the step export covered.
 *
 * The one view that shows dates the graders never touched -- steps are measured
 * every day, and a week nobody graded is still a week that happened.
 */
export function CalendarView({ payload }: { payload: Payload }) {
  const days = calendarDays(payload);
  if (!days.length) {
    return (
      <Card title="Daily load">
        <EmptyState>No steps.csv.</EmptyState>
      </Card>
    );
  }

  const meta = loadByDate(payload);
  const byDate = dayByDate(days);
  const rows = calendarRows(days.map((d) => d.date));

  return (
    <Card title="Daily load">
      <Legend
        items={[
          { color: "var(--series-1)", label: "run steps" },
          { color: "var(--series-2)", label: "background steps" },
          { color: "var(--critical)", label: "over the day's ceiling (outlined)" },
        ]}
      />

      <CalendarGrid
        rows={rows}
        byDate={byDate}
        meta={meta}
        maxSteps={maxSteps(days)}
      />

      <Note>
        Bar length is the day&apos;s step count against the busiest day on record,
        split into run and background. Steps are measured every day;
        step-equivalents and a day ceiling exist only for a week the load grader
        ran, and those days are outlined when the day went over. Hover any cell
        for both.
      </Note>

      <h3>Every day</h3>
      <DayTable days={days} meta={meta} />
    </Card>
  );
}
