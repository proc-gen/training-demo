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
        <WeekPicker
          payload={payload}
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
            <WeekView week={week} banners={payload.banners ?? []} />
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
