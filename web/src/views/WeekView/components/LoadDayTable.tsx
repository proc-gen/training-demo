"use client";

import { dayName, num, pct, shortDate, signed } from "@/lib/data/format";
import { unscoredReason } from "@/lib/data/loadDay";
import type { LoadDay } from "@/lib/data/payload";
import { Dot } from "@/lib/ux/primitives/Dot";
import { Table } from "@/lib/ux/primitives/Table";

/** Every day of the week: its load, and the training state on that date.
 *
 * IT CARRIED FOUR PROVENANCE COLUMNS UNTIL 2026-08-15 -- role, ceiling from,
 * run steps from, data -- and they are gone from here rather than deleted.
 * Within one week those strings barely vary, so four of twelve columns were
 * spent on them while the numbers a reader wants beside a day sat two tables
 * further down. All four still reach the reader through the bar chart's
 * tooltip, which is where a per-day fact that qualifies rather than measures
 * belongs.
 *
 * The exception is `completeness`, which cannot only live in a tooltip: a day
 * that is not scored has to say WHY on the row, or Saturday's `--` reads as a
 * zero rather than as a day still being lived. It renders in the Score cell,
 * which would otherwise be a bare dash -- so the one column that was load
 * bearing kept its place without keeping its column.
 *
 * TRIMP / CTL / ATL / TSB were already on every day record and already
 * published; they were simply never rendered per day. `FitnessTable` used to
 * show one of each for the whole week and was deleted when these arrived --
 * a component whose content is absorbed gets deleted, not left rendering the
 * same numbers a second time.
 */
export function LoadDayTable({ days }: { days: LoadDay[] }) {
  return (
    <Table
      headers={[
        { label: "Day" },
        { label: "Steps", num: true },
        { label: "Run SE", num: true },
        { label: "Bg SE", num: true },
        { label: "Day SE", num: true },
        { label: "Ceiling", num: true },
        { label: "Presc", num: true },
        { label: "Score", num: true },
        { label: "Run TRIMP", num: true },
        { label: "Bg TRIMP", num: true },
        { label: "CTL", num: true },
        { label: "ATL", num: true },
        { label: "TSB", num: true },
      ]}
    >
      {days.map((d) => (
        <tr key={d.date}>
          <td className="sec">
            {dayName(d.date)} {shortDate(d.date)}
          </td>
          <td className="num">{num(d.total_steps)}</td>
          <td className="num">{num(d.run_se)}</td>
          <td className="num">{num(d.nonrun_se)}</td>
          <td className="num">{num(d.se)}</td>
          <td className="num sec">{num(d.ceiling)}</td>
          {/* What the day was prescribed to cost, in minutes -- the input the
              ceiling beside it is built from. Shown because a ceiling that is
              DERIVED and cannot be checked is a number on trust. */}
          <td className="num sec">
            {d.prescribed_run_seconds == null
              ? "--"
              : `${Math.round(d.prescribed_run_seconds / 60)}m`}
          </td>
          {/* An unscored day says WHY, in the cell that would otherwise be a
              bare `--`. `in-progress` is a day still being lived, `partial-*`
              is an export that half-covered it, and `unpriced` is a day the
              plan did not state a duration for -- three completely different
              things that one dash cannot distinguish. */}
          <td className="num">
            {d.scored ? (
              <>
                <Dot pct={d.pct} /> <b>{pct(d.pct)}</b>
              </>
            ) : (
              <span className="warn">{unscoredReason(d)}</span>
            )}
          </td>
          <td className="num">{num(d.trimp, 1)}</td>
          {/* AN UNCALIBRATED ESTIMATE sitting beside a measurement. The header
              says which is which and `CeilingFormula`'s bullets say why; it is
              here rather than folded into Run TRIMP precisely so the two can
              never be added up by eye without noticing. */}
          <td className="num">{num(d.bg_trimp, 1)}</td>
          <td className="num sec">{num(d.ctl)}</td>
          <td className="num sec">{num(d.atl)}</td>
          <td className="num sec">{signed(d.tsb)}</td>
        </tr>
      ))}
    </Table>
  );
}
