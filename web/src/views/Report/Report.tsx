"use client";

import { useState } from "react";

import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { CalendarView } from "../CalendarView/CalendarView";
import { TrendsView } from "../TrendsView/TrendsView";
import { WeekView } from "../WeekView/WeekView";
import { TopBar } from "./components/TopBar";
import { ViewTabs, type View } from "./components/ViewTabs";
import { WeekPicker } from "./components/WeekPicker";
import { defaultWeekKey } from "./data/defaultWeek";

/** The report card: the shell, and which view is showing.
 *
 * The one component that holds view state. Everything below it takes props, so
 * each piece can be rendered and asserted on by itself.
 */
export function Report({ payload }: { payload: Payload }) {
  const keys = weekKeys(payload);
  const [selected, setSelected] = useState<string | null>(() =>
    defaultWeekKey(payload),
  );
  const [view, setView] = useState<View>("week");

  const week = selected ? payload.weeks[selected] : undefined;

  return (
    <TooltipProvider>
      <TopBar payload={payload} weekCount={keys.length} />

      {/* One filter row above everything it scopes, never inside a card. */}
      <div className="filters">
        {/* NO `payload`. The picker took it only to label each option with the
            week type, and the option list is gone -- see `WeekPicker`. It needs
            the KEY LIST and nothing else, which is also what keeps the shell's
            one job (which view is showing) from leaking downward. */}
        <WeekPicker
          keys={keys}
          selected={selected}
          onSelect={setSelected}
          hidden={view !== "week"}
        />
        <ViewTabs view={view} onSelect={setView} />
      </div>

      <main>
        {view === "week" ? (
          week ? (
            /* KEYED BY THE WEEK, SO A WEEK CHANGE RESETS THE WHOLE CARD.
             *
             * A different key is a different component instance, so every
             * `useState` beneath this line re-initialises: the card's tab, which
             * runs are expanded, the totals row, each chart's Pace/HR toggle and
             * whichever score bar was open. Five stateful components, one line.
             *
             * IT USED TO HAVE NO KEY, deliberately -- the argument was that a
             * sticky tab is what you want when comparing Training week to week.
             * The athlete read the live page and it is wrong: switching weeks
             * left the previous week's rows expanded BY POSITION, so row three
             * of the new week opened showing a different run's laps. A reader
             * who changes week is starting again, and lands on Overall.
             *
             * The alternatives are worse. A `useEffect` reset needs all five
             * components to participate; lifting the state into this shell puts
             * five unrelated concerns in the one component that is meant to hold
             * only which view is showing. */
            <WeekView
              key={selected}
              week={week}
              banners={payload.banners ?? []}
              /* The CHART, not the payload. `WeekView` needs one record and
                 handing it the whole payload would give it reach into every
                 other week, which is what the shell is for. The models
                 singleton rides beside it under the same rule. */
              paceChartCurrent={payload.pace_chart_current}
              paceModels={payload.pace_models_current}
            />
          ) : (
            <p className="empty-state">No week selected.</p>
          )
        ) : null}
        {view === "calendar" ? <CalendarView payload={payload} /> : null}
        {view === "trends" ? <TrendsView payload={payload} /> : null}
      </main>
    </TooltipProvider>
  );
}
