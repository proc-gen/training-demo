"use client";

import { shortDate } from "@/lib/data/format";
import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import type { PlanEntry } from "@/lib/run/data/runs";
import { isDone } from "../data/dayDone";
import type { CalendarMode } from "../data/mode";
import { CalendarCell } from "./CalendarCell";
import { EditDayButton } from "./EditDayButton";
import { EditWeekButton } from "./EditWeekButton";

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
 *
 * EACH SLOT IS A POSITIONED WRAPPER SINCE THE EDITOR LANDED (2026-09-03).
 * `CalendarCell` is itself a `<button>`, and the day's edit control cannot be
 * its child -- an interactive element inside another is invalid markup -- so
 * `.cal-slot` holds the two as siblings and the pencil floats over the
 * corner. The week's own pencil sits beside the row label, where the athlete
 * asked for it.
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
  authored,
  onEditDay,
  onEditWeek,
  mode,
  restDays,
  today,
}: {
  rows: { start: string; days: string[] }[];
  byDate: Map<string, Day>;
  meta: Map<string, LoadDay>;
  runs: Map<string, RunResult[]>;
  /** Date -> the manifest prescription of each of its runs, in run order,
   *  each with its alternates' words alongside. */
  prescriptions: Map<string, PlanEntry[]>;
  maxSteps: number;
  selected: string | null;
  onSelect: (date: string) => void;
  /** Week starts with a PUBLISHED record -- the label toggle between "edit"
   *  and "author"; the editor itself re-checks against the authored file. */
  authored: Set<string>;
  onEditDay: (date: string) => void;
  onEditWeek: (start: string) => void;
  /** Which of the Calendar's two jobs the grid is doing. */
  mode: CalendarMode;
  /** Every date the PLAN schedules rest on, across the window's weeks. */
  restDays: Set<string>;
  /** The date Plan mode marks up to -- see `data/dayDone.ts`. */
  today: string | null;
}) {
  /* THE `planned` HALF OF THE MARK IS DECIDED HERE, because this is where both
     halves of "the plan states something" are already in hand: a run row on the
     date, or the date being a scheduled rest day. It is deliberately NOT
     "the cell is not empty" -- an unstated date is a real and different fact,
     which `restDates` states at length. */
  const done = (date: string) =>
    isDone(date, today, (runs.get(date)?.length ?? 0) > 0 || restDays.has(date));
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
          <span className="cal-label">
            {shortDate(row.start)}
            <EditWeekButton
              start={row.start}
              authored={authored.has(row.start)}
              onEdit={() => onEditWeek(row.start)}
            />
          </span>
          {row.days.map((date) => (
            <span className="cal-slot" key={date}>
              <CalendarCell
                date={date}
                d={byDate.get(date)}
                m={meta.get(date)}
                runs={runs.get(date) ?? []}
                prescriptions={prescriptions.get(date) ?? []}
                maxSteps={maxSteps}
                selected={selected === date}
                onSelect={() => onSelect(date)}
                mode={mode}
                rest={restDays.has(date)}
                done={done(date)}
              />
              <EditDayButton date={date} onEdit={() => onEditDay(date)} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
