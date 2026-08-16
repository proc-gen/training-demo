"use client";

import { useState } from "react";

import { dayName, num, pct, shortDate } from "@/lib/data/format";
import type { Week } from "@/lib/data/payload";
import { ColumnChart } from "@/lib/ux/charts/ColumnChart";
import { Legend } from "@/lib/ux/primitives/Legend";
import { Tabs } from "@/lib/ux/primitives/Tabs";
import { TipRow } from "@/lib/ux/tooltip/TipRow";
import { AcwrTable } from "./AcwrTable";
import { CeilingFormula } from "./CeilingFormula";
import { FitnessNote } from "./FitnessNote";
import { LoadDayTable } from "./LoadDayTable";
import { ReadinessTable } from "./ReadinessTable";

/** Total load: running plus the walking and standing between runs.
 *
 * ALWAYS THE RUN/BACKGROUND SPLIT, never one total. A day over its ceiling
 * because the session ran long and a day over because of a hike produce the
 * same number and call for opposite responses.
 *
 * One tab of the week card since 2026-08-10, so it no longer carries a `Card`
 * or a title of its own -- the tab's label is the heading.
 *
 * TWO TABLES BEHIND ONE TOGGLE since 2026-08-15. They answer different
 * questions about the same seven days -- what the body was asked to do, and
 * what it reported back overnight -- and stacking them meant reaching the
 * second by scrolling past the first. The strip is `lib/ux/primitives/Tabs`,
 * the same one `WeekCard` and `ViewTabs` use: `views/WeekView` may not import
 * `views/Report`, so the alternative was a second copy of the same
 * role/aria-selected/aria-controls wiring, and the accessibility half is the
 * one nobody re-checks after copying.
 *
 * THE SELECTION RESETS ON A WEEK CHANGE FOR FREE, because `Report` renders
 * `<WeekView key={selected}>` -- a different key is a different instance.
 */
export function LoadPanel({ week }: { week: Week }) {
  const l = week.load!;
  const days = l.days ?? [];
  const [tab, setTab] = useState("steps");
  const panelId = "load-day-panel";

  const r = l.readiness;
  const readinessLabel =
    r?.available == null
      ? "Readiness"
      : `Readiness ${r.passed ?? "--"}/${r.available}`;

  return (
    <>
      <Legend
        items={[
          { color: "var(--series-1)", label: "run SE" },
          { color: "var(--series-2)", label: "background SE" },
          { color: "var(--critical)", label: "day ceiling" },
        ]}
      />
      <ColumnChart
        label="step-equivalents per day, run and background"
        columns={days.map((d) => ({
          label: `${dayName(d.date)} ${shortDate(d.date)}`,
          ceiling: d.ceiling,
          parts: [
            { value: d.run_se || 0, color: "var(--series-1)" },
            { value: d.nonrun_se || 0, color: "var(--series-2)" },
          ],
          /* THE PROVENANCE LIVES HERE NOW. Role, ceiling-from, run-steps-from
             and data left the day table on 2026-08-15 -- within one week those
             strings barely vary, so they were four columns saying little while
             the training state sat two tables below. A per-day fact that
             QUALIFIES a number rather than measuring one belongs beside it on
             demand, which is what a tooltip is. `data` joined the other three
             the same day for exactly that reason. */
          tip: () => (
            <>
              <b>
                {dayName(d.date)} {d.date} · {d.role || "unstated"}
              </b>
              <TipRow k="run SE" v={num(d.run_se)} />
              <TipRow k="background SE" v={num(d.nonrun_se)} />
              <TipRow k="day SE" v={num(d.se)} />
              <TipRow k="ceiling" v={num(d.ceiling)} />
              <TipRow k="ceiling from" v={d.ceiling_source || "unpriced"} />
              <TipRow k="score" v={pct(d.pct)} />
              <TipRow k="steps" v={num(d.total_steps)} />
              <TipRow k="run steps from" v={d.run_step_source || "--"} />
              <TipRow k="data" v={d.completeness || "--"} />
            </>
          ),
        }))}
      />

      <Tabs
        items={[
          { key: "steps", label: "Steps" },
          { key: "readiness", label: readinessLabel },
        ]}
        active={tab}
        onSelect={setTab}
        label="Load tables"
        panelId={panelId}
        className="in-card table-toggle"
      />
      <div id={panelId} role="tabpanel">
        {tab === "readiness" ? (
          <ReadinessTable readiness={r} />
        ) : (
          <>
            <LoadDayTable days={days} />
            <CeilingFormula week={week} />
            <FitnessNote load={l} />
          </>
        )}
      </div>

      <AcwrTable load={l} />
    </>
  );
}
