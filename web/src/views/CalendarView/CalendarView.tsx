"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Payload } from "@/lib/data/payload";
import { mondayOf, weekEnding } from "@/lib/data/weekDates";
import { PaceRail } from "@/lib/paces/PaceRail";
import {
  alternatesByKey,
  prescriptionByKey,
  type PlanEntry,
} from "@/lib/run/data/runs";
import { Card } from "@/lib/ux/primitives/Card";
import { Legend } from "@/lib/ux/primitives/Legend";
import { Note } from "@/lib/ux/primitives/Note";
import { RailLayout } from "@/lib/ux/primitives/RailLayout";
import { Tabs } from "@/lib/ux/primitives/Tabs";
import { CalendarControls } from "./components/CalendarControls";
import { CalendarGrid } from "./components/CalendarGrid";
import { DayCard } from "./components/DayCard";
import { DayEditorModal } from "./components/DayEditorModal";
import { ManageTemplatesButton } from "./components/ManageTemplatesButton";
import { TemplateManagerModal } from "./components/TemplateManagerModal";
import { WeekEditorModal } from "./components/WeekEditorModal";
import {
  calendarDays,
  dayByDate,
  loadByDate,
  restDates,
  runsByDate,
  weekFor,
  weekTotals,
} from "./data/days";
import { EMPHASIS_ORDER, EMPHASIS_LABEL, tintVar } from "./data/emphasis";
import {
  CALENDAR_MODES,
  MODE_LABEL,
  calendarHref,
  type CalendarMode,
} from "./data/mode";
import { clampWeeks, stepLastDay, weekRowsEnding } from "./data/window";

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
 * THERE IS NO EMPTY STATE ANY MORE, and that is the athlete's own rule reaching
 * this component. It used to render "No steps.csv and no week manifests" when
 * it could not pick a last day; the anchor is a PROP now, so there is always
 * one, and the honest reading of an anchor the record does not reach is the one
 * `stepLastDay` already states: *stepping past the record draws a grid of empty
 * cells, which is an honest answer rather than a disabled button that cannot
 * say why.* A window in 2019 and a window past the plan are the same case, and
 * the grid says so by being empty.
 *
 * THE ATHLETE-HAS-NOTHING CASE IS REPORTED UPSTREAM, where it can be told
 * apart: `loadShell` fails and the layout carries the sentence. Keeping a
 * message here that only the empty window could reach would be a card telling a
 * reader their data is missing because they stepped into 2019.
 *
 * THE ANCHOR AND THE WEEK COUNT ARE BOTH THE ROUTE'S NOW, so every control on
 * the filter row navigates and this component holds no window state at all.
 * `lastDay` arrives as a PROP and it no longer computes `defaultLastDay` -- the
 * same answer, from the same rule, resolved in `slices.ts` where the route needs
 * it anyway.
 *
 * THE TWO PARAMETERS ARE STILL NOT THE SAME KIND OF THING, and the difference is
 * what is FETCHED. The anchor reaches across all 102 weeks and decides the
 * slice; sending all of them is the 2,191 KB the split exists to avoid. The
 * count decides only how much of that slice is DRAWN -- the server sends the
 * widest window the dropdown offers whatever it says. It became a parameter
 * anyway, on 2026-09-07, because as state it reset on every step of the window;
 * `resolveWeeks` carries that story and the cost.
 *
 * `maxSteps` ARRIVES AS A PROP FOR THE OPPOSITE REASON: it is over the whole
 * record and the payload here is one window, so it is the one number on this
 * view that CANNOT be derived from what was sent. Scaling to the busiest day on
 * screen would make every bar jump the moment the week count changed.
 *
 * THE DAY TABLE IS GONE and `DayCard` stands in its place. That table listed
 * every date in the payload so the grid's colour-encoded values could also be
 * read as numbers -- seventy-six rows to discharge a concern about one cell.
 * The cells carry their own numbers now, the tooltip carries the provenance,
 * and the card carries the whole day the moment somebody points at it.
 *
 * TWO MODES, BECAUSE THIS VIEW DOES TWO JOBS. It is the RECORD and it is where
 * the plan is AUTHORED, and those want different cells -- see `data/mode.ts`.
 * View is everything below as it always was; Plan drops every measurement, the
 * day card and the click that opens it, and puts the whole prescription in the
 * hover. The mode is a QUERY PARAMETER and arrives as a prop, because this
 * component is keyed on the window and state here would reset on every step.
 *
 * `today` IS THE THIRD PROP THE PAYLOAD CANNOT SUPPLY, beside `lastDay` and
 * `maxSteps`, and it is the only one that is not a fact about the record at
 * all. Plan mode marks every day the plan states something for that is today
 * or earlier; `data/dayDone.ts` is the rule and says why the clock is read on
 * the server rather than here.
 */
export function CalendarView({
  payload,
  lastDay,
  maxSteps,
  mode,
  weeks,
  today,
}: {
  payload: Payload;
  /** The window's last day -- a Sunday, and the route's own segment. */
  lastDay: string;
  /** The busiest day's steps ON RECORD, not in this window. */
  maxSteps: number;
  /** View (the record) or Plan (the prescriptions). */
  mode: CalendarMode;
  /** How many weeks of the slice to draw, resolved from `?weeks=`. */
  weeks: number;
  /** THE DATE PLAN MODE MARKS UP TO, read on the SERVER and handed down. Like
   *  `maxSteps` it cannot be derived from the payload -- and unlike `maxSteps`
   *  it deliberately is not derived in the browser either: `data/dayDone.ts`
   *  carries the reasoning, and `runStatus.ts` carries the hook it replaced. */
  today: string | null;
}) {
  const router = useRouter();
  const plan = mode === "plan";
  const days = calendarDays(payload);
  /* A QUERY PARAMETER, NOT A SEGMENT. `?end=` is read from the URL by the
     browser, so it needs no `generateStaticParams` and the demo can be stepped
     as far as this app can -- which `stepLastDay` has always allowed and the
     old bounded segment could not honour. `weekEnding` still normalises, because
     all seven of a week's dates name one window and the URL names it once.

     ONE HELPER FOR ALL THREE PARAMETERS. `calendarHref` composes the URL, so
     the date field, the arrows, the mode strip and the week-count dropdown
     cannot drop each other's value -- which in Plan mode would drop the reader
     back into the record every time they stepped a week, and which reset the
     count to four on every step until `?weeks=` landed. */
  const go = (to: string) => router.push(calendarHref(weekEnding(to), mode, weeks));
  /* NOTHING IS SELECTED TO START. A card the reader did not ask for, about a
   * day the app chose, is a claim that that day is the interesting one -- and
   * on a first paint there is no basis for it. The empty state says what to do
   * in four words. */
  const [selected, setSelected] = useState<string | null>(null);

  /* THE PLAN EDITOR (2026-09-03): a pencil on every day cell and one beside
   * each week label, per the athlete's design. Which editor is open is view
   * state like `selected`; a successful save calls `router.refresh()` so the
   * server re-reads the slice from the index the publish just moved. Editing
   * a PAST day is deliberately no different from a future one -- the
   * athlete's explicit choice, with the tracked diff as the review artifact. */
  const [editing, setEditing] = useState<
    { kind: "day"; date: string } | { kind: "week"; start: string } | null
  >(null);

  /* THE TEMPLATE MANAGER IS ITS OWN STATE, NOT A THIRD `editing` KIND. It edits
   * no week and no day -- `run-templates.json` is a different file at the same
   * authored tier -- so it closes on nothing, refreshes nothing, and must not
   * be reachable through a union whose every other member names a date. */
  const [managing, setManaging] = useState(false);

  const meta = loadByDate(payload);
  const byDate = dayByDate(days);
  const runs = runsByDate(payload);
  const rows = weekRowsEnding(lastDay, weeks);
  const rest = restDates(payload);

  /* Date -> each of its runs' prescriptions, in run order -- with each run's
     pre-authored ALTERNATES riding along for Plan mode's `Alt:` lines. Built
     here rather than in the cell so the manifest lookup happens once per week
     instead of once per run: both `*ByKey` helpers walk a week's whole run
     list. */
  const prescriptions = new Map<string, PlanEntry[]>();
  for (const [date, list] of runs) {
    const week = weekFor(payload, date);
    const byKey = week ? prescriptionByKey(week) : null;
    const altsByKey = week ? alternatesByKey(week) : null;
    prescriptions.set(
      date,
      list.map((r) => ({
        text:
          (r.key ? byKey?.get(r.key) : "") ||
          r.planned?.prescribed ||
          "",
        alts: (r.key ? altsByKey?.get(r.key) : undefined) ?? [],
      })),
    );
  }

  return (
    <RailLayout
      /* THE ANCHOR WEEK'S OWN CHART in the week column -- the window's last
         week is the one the reader is looking at, and its targets are what the
         sessions on screen were graded against. A week with no published
         record leaves the column out entirely rather than filling it with a
         neighbour's numbers. */
      rail={
        <PaceRail
          week={weekFor(payload, lastDay)}
          current={payload.pace_chart_current}
        />
      }
    >
      <Card
        title={plan ? "Plan" : "Daily load"}
        /* THE SAME STRIP THE WEEK CARD'S FOUR SUB-VIEWS USE, which is what the
           athlete asked it to look like. It NAVIGATES rather than setting
           state: the mode is in the URL. */
        actions={
          <Tabs
            items={CALENDAR_MODES.map((m) => ({ key: m, label: MODE_LABEL[m] }))}
            active={mode}
            onSelect={(m) =>
              router.push(calendarHref(lastDay, m as CalendarMode, weeks))
            }
            label="Calendar mode"
            className="in-card"
          />
        }
      >
        <CalendarControls
          lastDay={lastDay}
          weeks={weeks}
          onLastDay={go}
          /* IT NAVIGATES NOW, like every other control on this row. The anchor
             does not move -- only how much of the window is drawn -- and the
             slice is a function of the anchor alone, so this refetches bytes it
             already had. That is the stated cost of the count surviving a
             step; `resolveWeeks` carries the trade. */
          onWeeks={(w) => router.push(calendarHref(lastDay, mode, clampWeeks(w)))}
          /* The step is a function of the window that is showing, so it is
             resolved here where both halves of that window are held. It
             NAVIGATES: the anchor is the route. */
          onStep={(steps) => go(stepLastDay(lastDay, weeks, steps))}
          /* THE SAME FUNCTION AT A WIDTH OF ONE. `stepLastDay` already takes
             the increment, so the finer arrows are not a second piece of
             arithmetic that could disagree with the first about where a week
             boundary is. */
          onStepWeek={(steps) => go(stepLastDay(lastDay, 1, steps))}
        />

        {/* TWO ROWS, BECAUSE THERE ARE TWO KINDS OF THING IN THIS KEY. The first
            is what the BAR is made of and the outline that marks a breach; the
            second is what the CELL is washed with. They were one row of six and
            read as one vocabulary.

            THE FIRST ROW IS ABOUT MEASUREMENTS and goes with them in Plan mode:
            a key to a bar that is not drawn is a key to nothing. */}
        {plan ? null : (
          <Legend
            items={[
              { color: "var(--series-1)", label: "run steps" },
              { color: "var(--series-2)", label: "background steps" },
              {
                color: "var(--critical)",
                label: "over the day's ceiling (outlined)",
              },
            ]}
          />
        )}
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
          maxSteps={maxSteps}
          selected={selected}
          onSelect={(date) => setSelected((v) => (v === date ? null : date))}
          authored={new Set(Object.keys(payload.weeks ?? {}))}
          onEditDay={(date) => setEditing({ kind: "day", date })}
          onEditWeek={(start) => setEditing({ kind: "week", start })}
          mode={mode}
          restDays={rest}
          today={today}
        />

        {plan ? (
          <>
            <Note>
              What the plan asks for, and nothing that was measured. A tinted
              cell is the session&apos;s emphasis rather than a verdict, and a
              day that is two things is split between both. A ✓ marks a day the
              plan states something for that is today or earlier. Hover any cell
              for its whole prescription — the lines in the cell are clipped —
              and use the pencil to edit the day or the week.
            </Note>
            {/* PLAN MODE ONLY. A template is a PRESCRIPTION, so it belongs
                beside the prescriptions; View is the record and has nothing to
                do with authoring one. */}
            <ManageTemplatesButton onOpen={() => setManaging(true)} />
          </>
        ) : (
          <Note>
            Bar length is the day&apos;s step count against the busiest day on
            record, split into run and background — so the scale does not move
            when the window does. Steps are measured every day; step-equivalents
            and a day ceiling exist only for a week the load grader ran, and
            those days are outlined when the day went over. A tinted cell is what
            the plan asked for, not a verdict, and a day that is two things is
            split between both. Hover any cell for the rest; click one for the
            whole day.
          </Note>
        )}
      </Card>

      {/* NO DAY CARD IN PLAN MODE. It is an account of what was measured, and
          the athlete asked for hover only -- so the cell opens nothing and this
          is not rendered at all. `selected` survives the switch on purpose:
          coming back to View shows the day that was open. */}
      {plan ? null : <DayCard payload={payload} date={selected} />}

      {/* THE MODE REACHES THE DIALOGS, AND DECIDES WHICH CONTROLS THEY DRAW.
          Plan mode edits the plan; View mode edits the notes, which are
          retrospective. It never decides what is POSTED -- see the dialogs. */}
      {editing?.kind === "day" ? (
        <DayEditorModal
          weekStart={mondayOf(editing.date)}
          date={editing.date}
          mode={mode}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}
      {editing?.kind === "week" ? (
        <WeekEditorModal
          weekStart={editing.start}
          mode={mode}
          /* WHAT THE WEEK ACTUALLY CAME TO, beside what was planned for it.
             It is already here -- the calendar slice sends the whole week
             record for every week in the widest window -- so the dialog
             takes a prop rather than a second fetch. */
          facts={weekTotals(payload, editing.start)}
          onClose={() => setEditing(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {/* NO `onSaved`, AND THAT IS THE FEATURE. Editing a template moves no
          manifest and therefore no grade -- a run built from one holds its own
          COPY of the prescription -- so there is nothing to re-read and no
          `router.refresh()` to run. */}
      {managing ? (
        <TemplateManagerModal onClose={() => setManaging(false)} />
      ) : null}
    </RailLayout>
  );
}
