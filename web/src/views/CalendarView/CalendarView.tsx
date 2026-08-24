"use client";

import { useState } from "react";

import type { Payload } from "@/lib/data/payload";
import { prescriptionByKey } from "@/lib/run/data/runs";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { Legend } from "@/lib/ux/primitives/Legend";
import { Note } from "@/lib/ux/primitives/Note";
import { CalendarControls } from "./components/CalendarControls";
import { CalendarGrid } from "./components/CalendarGrid";
import { DayCard } from "./components/DayCard";
import {
  calendarDays,
  dayByDate,
  loadByDate,
  maxSteps,
  runsByDate,
  weekFor,
} from "./data/days";
import { EMPHASIS_ORDER, EMPHASIS_LABEL, tintVar } from "./data/emphasis";
import {
  DEFAULT_WEEKS,
  clampWeeks,
  defaultLastDay,
  stepLastDay,
  weekRowsEnding,
} from "./data/window";

/** The plan and the measurements, side by side, day by day.
 *
 * IT IS A WINDOW NOW, not the whole record. Four weeks ending on the last day
 * measured, movable to one through six and to any last day -- including forward,
 * onto the sessions the plan states for the weeks ahead, which this view could
 * not reach at all while its dates came from `payload.days`.
 *
 * THE DEFAULT ANCHOR IS THE DATA, NEVER A BROWSER CLOCK -- `window.ts` gives
 * that at length. It is the third place in this app to make the same choice and
 * for the same reason: an answer that depends on when you look cannot be
 * asserted against the committed `published/` tree.
 *
 * THE DAY TABLE IS GONE and `DayCard` stands in its place. That table listed
 * every date in the payload so the grid's colour-encoded values could also be
 * read as numbers -- seventy-six rows to discharge a concern about one cell.
 * The cells carry their own numbers now, the tooltip carries the provenance,
 * and the card carries the whole day the moment somebody points at it.
 */
export function CalendarView({ payload }: { payload: Payload }) {
  const days = calendarDays(payload);
  const [lastDay, setLastDay] = useState<string | null>(() =>
    defaultLastDay(payload),
  );
  const [weeks, setWeeks] = useState<number>(DEFAULT_WEEKS);
  /* NOTHING IS SELECTED TO START. A card the reader did not ask for, about a
   * day the app chose, is a claim that that day is the interesting one -- and
   * on a first paint there is no basis for it. The empty state says what to do
   * in four words. */
  const [selected, setSelected] = useState<string | null>(null);

  if (!lastDay) {
    return (
      <Card title="Daily load">
        <EmptyState>No steps.csv and no week manifests.</EmptyState>
      </Card>
    );
  }

  const meta = loadByDate(payload);
  const byDate = dayByDate(days);
  const runs = runsByDate(payload);
  const rows = weekRowsEnding(lastDay, weeks);

  /* Date -> each of its runs' prescriptions, in run order. Built here rather
     than in the cell so the manifest lookup happens once per week instead of
     once per run: `prescriptionByKey` walks a week's whole run list. */
  const prescriptions = new Map<string, string[]>();
  for (const [date, list] of runs) {
    const week = weekFor(payload, date);
    const byKey = week ? prescriptionByKey(week) : null;
    prescriptions.set(
      date,
      list.map((r) => (r.key ? byKey?.get(r.key) : "") || r.prescribed || ""),
    );
  }

  return (
    <>
      <Card title="Daily load">
        <CalendarControls
          lastDay={lastDay}
          weeks={weeks}
          onLastDay={setLastDay}
          onWeeks={(w) => setWeeks(clampWeeks(w))}
          /* The step is a function of the window that is showing, so it is
             resolved here where both halves of that window are held. */
          onStep={(steps) => setLastDay(stepLastDay(lastDay, weeks, steps))}
        />

        {/* TWO ROWS, BECAUSE THERE ARE TWO KINDS OF THING IN THIS KEY. The first
            is what the BAR is made of and the outline that marks a breach; the
            second is what the CELL is washed with. They were one row of six and
            read as one vocabulary. */}
        <Legend
          items={[
            { color: "var(--series-1)", label: "run steps" },
            { color: "var(--series-2)", label: "background steps" },
            { color: "var(--critical)", label: "over the day's ceiling (outlined)" },
          ]}
        />
        {/* THE CHIPS ARE THE TINT, NOT THE HUE IT IS MIXED FROM. They showed the
            full-strength colour until 2026-08-16, so the key did not match the
            page it was a key to — the athlete's own note. `tintVar` is the one
            place that spells the variable, so the chip and the cell cannot
            disagree; `outlined` is what makes a 22% wash visible at 11px.
            Generated from the published vocabulary, so a token added to the
            grader cannot be absent here. */}
        <Legend
          items={EMPHASIS_ORDER.map((t) => ({
            color: tintVar(t),
            label: EMPHASIS_LABEL[t],
            outlined: true,
          }))}
        />

        <CalendarGrid
          rows={rows}
          byDate={byDate}
          meta={meta}
          runs={runs}
          prescriptions={prescriptions}
          maxSteps={maxSteps(days)}
          selected={selected}
          onSelect={(date) => setSelected((v) => (v === date ? null : date))}
        />

        <Note>
          Bar length is the day&apos;s step count against the busiest day on
          record, split into run and background — so the scale does not move when
          the window does. Steps are measured every day; step-equivalents and a
          day ceiling exist only for a week the load grader ran, and those days
          are outlined when the day went over. A tinted cell is what the plan
          asked for, not a verdict, and a day that is two things is split between
          both. Hover any cell for the rest; click one for the whole day.
        </Note>
      </Card>

      <DayCard payload={payload} date={selected} />
    </>
  );
}
