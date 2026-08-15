"use client";

import { dayName, num, pct, shortDate } from "@/lib/data/format";
import type { Week } from "@/lib/data/payload";
import { ColumnChart } from "@/lib/ux/charts/ColumnChart";
import { Legend } from "@/lib/ux/primitives/Legend";
import { TipRow } from "@/lib/ux/tooltip/TipRow";
import { AcwrTable } from "./AcwrTable";
import { CeilingFormula } from "./CeilingFormula";
import { FitnessTable } from "./FitnessTable";
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
 */
export function LoadPanel({ week }: { week: Week }) {
  const l = week.load!;
  const days = l.days ?? [];

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
              <TipRow k="source" v={d.run_step_source || "--"} />
            </>
          ),
        }))}
      />

      <CeilingFormula week={week} />
      <LoadDayTable days={days} />
      <ReadinessTable readiness={l.readiness} />
      <AcwrTable load={l} />
      <FitnessTable load={l} />
    </>
  );
}
