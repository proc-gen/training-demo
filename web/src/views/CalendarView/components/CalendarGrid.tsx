"use client";

import { shortDate } from "@/lib/data/format";
import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import { CalendarCell } from "./CalendarCell";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The Monday-based grid of week rows.
 *
 * EVERY SLOT IS A REAL CELL. It used to render an empty one wherever a date had
 * no measurement, which was right while the grid was built out of the dates
 * that HAD measurements; the window states its own dates now, so a day with no
 * steps is a day with no steps -- and it may still carry a prescription, which
 * is the whole reason the view reaches into the plan at all.
 *
 * The columns stay aligned to weekdays because the rows are whole Mon-Sun
 * weeks. A calendar whose Wednesdays are not all in one column is not a
 * calendar.
 */
export function CalendarGrid({
  rows,
  byDate,
  meta,
  runs,
  prescriptions,
  maxSteps,
  selected,
  onSelect,
}: {
  rows: { start: string; days: string[] }[];
  byDate: Map<string, Day>;
  meta: Map<string, LoadDay>;
  runs: Map<string, RunResult[]>;
  /** Date -> the manifest prescription of each of its runs, in run order. */
  prescriptions: Map<string, string[]>;
  maxSteps: number;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="cal-weeks">
      <div className="cal-row">
        <span />
        {WEEKDAYS.map((x) => (
          <span className="cal-head" key={x}>
            {x}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="cal-row" key={row.start}>
          <span className="cal-label">{shortDate(row.start)}</span>
          {row.days.map((date) => (
            <CalendarCell
              key={date}
              date={date}
              d={byDate.get(date)}
              m={meta.get(date)}
              runs={runs.get(date) ?? []}
              prescriptions={prescriptions.get(date) ?? []}
              maxSteps={maxSteps}
              selected={selected === date}
              onSelect={() => onSelect(date)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
