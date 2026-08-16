"use client";

import { useId, useState } from "react";

import { Dot } from "@/lib/ux/primitives/Dot";
import { Note } from "@/lib/ux/primitives/Note";
import { RowExpander } from "@/lib/ux/primitives/RowExpander";
import { RUN_COLUMNS } from "@/lib/run/data/runColumns";
import type { RunTotalsRowData } from "../data/runTotals";
import type { WeekFacts } from "../data/facts";
import { RunTotals } from "./RunTotals";

/** The week's totals, as the LAST ROW OF THE RUNS TABLE.
 *
 * Volume, long run and easy/quality used to sit ABOVE the table, where they read
 * as a header -- a preamble to the runs rather than the sum of them. At the foot
 * they land where a reader arrives after the detail, in the same columns the
 * rows above use, which is what makes them legible as totals at all.
 *
 * IT EXPANDS LIKE A RUN, and reuses the same `RowExpander`, so there is one
 * interaction on this table rather than two. `RunTotals` is not deleted by this
 * -- it becomes the body of the expansion. A component another one absorbs is
 * not deleted by that.
 *
 * THE NOTE IS NOT OPTIONAL. Two cells here are deliberately not sums of the
 * column above them (volume excludes walks; the score is a ratio of seconds),
 * and a totals row that does not say so reads as broken arithmetic.
 */
export function RunTotalsRow({
  totals,
  facts,
  judged,
}: {
  totals: RunTotalsRowData;
  facts: WeekFacts;
  judged: WeekFacts;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = () => setOpen((v) => !v);

  return (
    <>
      <tr className={"total-row clickable" + (open ? " is-open" : "")} onClick={toggle}>
        <td className="sec">
          <RowExpander
            label="Total"
            ariaLabel="the week's totals"
            open={open}
            panelId={panelId}
            onToggle={toggle}
          />
        </td>
        <td />
        <td className="num">{totals.miles}</td>
        <td className="num">{totals.seconds}</td>
        <td className="num">{totals.pace}</td>
        {/* No week-level heart rate exists, and averaging the column would
            invent one. Blank rather than `--`, which reads as a measurement
            that failed. */}
        <td />
        <td className="num">{totals.trimp}</td>
        {/* Same again: a week has no single cadence. */}
        <td />
        <td className="num">
          <Dot pct={totals.pct} />{" "}
          {totals.pct === null ? (
            <span className="muted">--</span>
          ) : (
            <b>{Math.round(totals.pct)}%</b>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={RUN_COLUMNS.length} id={panelId}>
            <RunTotals facts={facts} judged={judged} />
            <Note>{totals.note}</Note>
          </td>
        </tr>
      ) : null}
    </>
  );
}
