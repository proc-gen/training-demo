"use client";

import { shortDate } from "@/lib/data/format";
import type { Day, LoadDay } from "@/lib/data/payload";
import { CalendarCell } from "./CalendarCell";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The Monday-based grid of week rows.
 *
 * A slot with no data renders as an EMPTY CELL rather than being skipped, so
 * the columns stay aligned to weekdays -- a calendar whose Wednesdays are not
 * all in one column is not a calendar.
 */
export function CalendarGrid({
  rows,
  byDate,
  meta,
  maxSteps,
}: {
  rows: { start: string; days: (string | null)[] }[];
  byDate: Map<string, Day>;
  meta: Map<string, LoadDay>;
  maxSteps: number;
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
          {row.days.map((date, i) =>
            date && byDate.has(date) ? (
              <CalendarCell
                key={i}
                d={byDate.get(date)!}
                m={meta.get(date)}
                maxSteps={maxSteps}
              />
            ) : (
              <span className="cal-cell empty" key={i} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
