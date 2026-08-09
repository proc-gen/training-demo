"use client";

import { dayName, num, pct, shortDate } from "@/lib/data/format";
import type { LoadDay } from "@/lib/data/payload";
import { Dot } from "@/lib/ux/primitives/Dot";
import { Table } from "@/lib/ux/primitives/Table";

/** Every day of the week, and where each number came from.
 *
 * Three provenance columns, which is the point of the table: a ceiling that is
 * DERIVED and cannot be checked is a number on trust, and an estimate must
 * never read as a measurement.
 */
export function LoadDayTable({ days }: { days: LoadDay[] }) {
  return (
    <Table
      headers={[
        { label: "Day" },
        { label: "Role" },
        { label: "Steps", num: true },
        { label: "Run SE", num: true },
        { label: "Bg SE", num: true },
        { label: "Day SE", num: true },
        { label: "Ceiling", num: true },
        { label: "Presc", num: true },
        { label: "Score", num: true },
        { label: "Ceiling from" },
        { label: "Run steps from" },
        { label: "Data" },
      ]}
    >
      {days.map((d) => (
        <tr key={d.date}>
          <td className="sec">
            {dayName(d.date)} {shortDate(d.date)}
          </td>
          {/* A null role is a date the manifest never mentioned. Said plainly
              rather than left blank, which reads as a rendering bug, or shown
              as "rest", which is the assumption the grader stopped making --
              an unlived day is not a day off. */}
          <td className={d.role ? undefined : "muted"}>{d.role || "unstated"}</td>
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
          <td className="num">
            <Dot pct={d.pct} /> <b>{pct(d.pct)}</b>
          </td>
          {/* Which tier priced it, beside the ceiling for the same reason
              `run_step_source` sits beside the run steps: an estimate must
              never read as a measurement. `unpriced` is a day the plan did
              not state a duration for. */}
          <td className={d.ceiling_source ? "sec" : "warn"}>
            {d.ceiling_source || "unpriced"}
          </td>
          <td className="sec">{d.run_step_source || "--"}</td>
          <td className={d.scored ? "sec" : "warn"}>{d.completeness}</td>
        </tr>
      ))}
    </Table>
  );
}
