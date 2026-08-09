"use client";

import { dayName, n, num, shortDate } from "@/lib/data/format";
import type { Day, LoadDay } from "@/lib/data/payload";
import { TipRow } from "@/lib/ux/tooltip/TipRow";
import { useTip } from "@/lib/ux/tooltip/hooks/useTip";
import { isOverCeiling } from "../data/days";

/** One day: its date, its step count, and a two-part bar.
 *
 * The bar is scaled in STEPS against the busiest day on record -- see
 * `maxSteps` for why it cannot be step-equivalents. SE, the ceiling and the
 * breach outline ride along only where the graders produced them.
 */
export function CalendarCell({
  d,
  m,
  maxSteps,
}: {
  d: Day;
  m: LoadDay | undefined;
  maxSteps: number;
}) {
  const se = m?.se ?? null;
  const over = isOverCeiling(m);
  const total = n(d.total_steps) || 0;
  const runPart = n(d.run_steps) || 0;
  const bgPart = n(d.nonrun_steps) || 0;
  const scale = Math.max(0, Math.min(1, total / maxSteps));

  const handlers = useTip(() => (
    <>
      <b>
        {dayName(d.date)} {d.date}
        {m?.role ? " · " + m.role : ""}
      </b>
      <TipRow k="steps" v={num(n(d.total_steps))} />
      {se ? (
        <>
          <TipRow k="run SE" v={num(m?.run_se)} />
          <TipRow k="background SE" v={num(m?.nonrun_se)} />
          <TipRow k="day SE" v={num(se)} />
          <TipRow k="ceiling" v={num(m?.ceiling)} />
        </>
      ) : null}
      {d.resting_hr ? <TipRow k="resting HR" v={d.resting_hr} /> : null}
      {d.sleep_hours ? <TipRow k="sleep" v={`${d.sleep_hours} h`} /> : null}
    </>
  ));

  return (
    <span className={"cal-cell" + (over ? " over" : "")} {...handlers}>
      <span className="d">{shortDate(d.date)}</span>
      <span className="v">{num(n(d.total_steps))}</span>
      <span className="cal-bar">
        {(
          [
            [runPart, "var(--series-1)"],
            [bgPart, "var(--series-2)"],
          ] as const
        ).map(([v, color], i) =>
          v && total ? (
            <i
              key={i}
              style={{ width: 100 * scale * (v / total) + "%", background: color }}
            />
          ) : null,
        )}
      </span>
    </span>
  );
}
