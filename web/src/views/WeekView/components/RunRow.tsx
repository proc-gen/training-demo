"use client";

import { useState } from "react";

import { clock, dayName, num, pace, shortDate } from "@/lib/data/format";
import type { PaceChart, RunResult } from "@/lib/data/payload";
import { Dot } from "@/lib/ux/primitives/Dot";
import { SessionDetail } from "./SessionDetail";

/** One run, expanding to its rep tables when it has any.
 *
 * A run with no detected reps is NOT clickable -- an expander that opens on
 * nothing is worse than no expander, because it reads as missing data rather
 * than as an easy run.
 */
export function RunRow({
  r,
  prescribed,
  chart,
}: {
  r: RunResult;
  prescribed: string;
  chart: PaceChart | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const sets = r.detail?.sets ?? [];
  const hasReps = sets.some((st) => (st.rep_rows ?? []).length);

  return (
    <>
      <tr
        className={hasReps ? "clickable" + (open ? " is-open" : "") : undefined}
        onClick={hasReps ? () => setOpen((v) => !v) : undefined}
      >
        <td className="sec">
          {dayName(r.date!)} {shortDate(r.date!)}
        </td>
        <td>{r.role}</td>
        <td className="sec">{prescribed}</td>
        <td className="num">{num(r.miles, 2)}</td>
        <td className="num">{clock(r.seconds)}</td>
        <td className="num">{pace(r.pace)}</td>
        <td className="num">
          {(r.hr_avg || "--") + " / " + (r.hr_max || "--")}
        </td>
        {/* A NAME or a printed range, never a number -- and `--` where the
            ceiling is uncalibrated, which means the run is REPORTED rather than
            scored. Never falling back to the next ceiling down is the point:
            tempo, progression and an alternation float are all meant to run
            above the easy ceiling. */}
        <td className="num sec">{r.ceiling || "--"}</td>
        <td className="num">
          <Dot pct={r.pct} />{" "}
          {r.pct === null || r.pct === undefined ? (
            <span className="muted">--</span>
          ) : (
            <b>{Math.round(r.pct)}%</b>
          )}
        </td>
      </tr>
      {hasReps && open ? (
        <tr>
          <td colSpan={9}>
            <SessionDetail sets={sets} chart={chart} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
