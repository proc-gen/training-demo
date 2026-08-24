"use client";

import { useId, useState } from "react";

import { clock, dayName, num, pace, shortDate } from "@/lib/data/format";
import type { PaceChart, RunResult } from "@/lib/data/payload";
import { Dot } from "@/lib/ux/primitives/Dot";
import { RowExpander } from "@/lib/ux/primitives/RowExpander";
import { RUN_COLUMNS } from "./data/runColumns";
import { RUN_STATUS_LABEL, isPlanned, runStatus } from "./data/runStatus";
import type { TrimpRow } from "./data/trimp";
import { RunDetail } from "./RunDetail";

/** One run, expanding to its own explanation, laps or reps, and chart.
 *
 * EVERY ROW OPENS NOW. It used to be clickable only where reps had been
 * detected, on the argument that "an expander that opens on nothing is worse
 * than no expander" -- which was true of the panel as it stood, and stopped
 * being true once a run had a lap table, a duration verdict and an account of
 * its own score to show. An easy run has all three.
 *
 * THE EXPANDER IS A REAL BUTTON. The `<tr>` keeps its click handler for the
 * row-wide pointer target, but the semantics live on `RowExpander` --
 * `aria-expanded`, `aria-controls`, reachable by keyboard. The bare clickable
 * `<tr>` this replaces is named in CLAUDE.md as "a gap, not a pattern to copy".
 *
 * `showDay` BLANKS A REPEATED DATE. A day with four activities printed `Tue 8/4`
 * four times, which reads as four separate days. The expander still renders on
 * the blank cell and still carries a full `aria-label`, so a screen reader never
 * meets an unlabelled control.
 */
export function RunRow({
  r,
  prescribed,
  chart,
  showDay,
  trimp,
}: {
  r: RunResult;
  prescribed: string;
  chart: PaceChart | null | undefined;
  showDay: boolean;
  trimp?: TrimpRow;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const day = r.date ? `${dayName(r.date)} ${shortDate(r.date)}` : "--";
  const toggle = () => setOpen((v) => !v);
  // THE GRADER'S OWN VERDICT. It knows the evaluation cutoff; the browser does
  // not, and a second clock here could disagree with the score beside it.
  const status = runStatus(r);
  const planned = isPlanned(r);

  return (
    <>
      <tr
        // NO `is-planned` CLASS, deliberately. A planned row is marked in
        // WORDS, in the Score cell, and that is the whole marking. Two things
        // ruled out a visual one: muting the row would mute the PRESCRIPTION,
        // which is the one thing worth reading on a session that has not
        // happened; and a background tint cannot carry it either, because
        // `--surface-1` and `--page` are 1.03:1 apart and the two states this
        // row already has -- hover and open -- both use `--page`. A class with
        // no rule behind it is dead markup, so there is none.
        className={"clickable" + (open ? " is-open" : "")}
        onClick={toggle}
      >
        <td className="sec">
          <RowExpander
            label={showDay ? day : ""}
            // The status is IN the accessible name, because for a planned row
            // every other cell is a dash -- a screen reader would otherwise
            // meet a row of nothing with no explanation.
            ariaLabel={
              `${day} · ${prescribed || r.role || "run"}` +
              (planned ? ` · ${RUN_STATUS_LABEL[status]}` : "")
            }
            open={open}
            panelId={panelId}
            onToggle={toggle}
          />
        </td>
        <td className="sec">{prescribed}</td>
        {/* A PLANNED ROW SHOWS DASHES, NOT ZEROES, in every measured column.
            The grader publishes null for each of these rather than 0 for the
            same reason: a zero is a claim -- it reads as a run of no distance
            in no time -- where a dash says nothing was measured. `num` and
            `clock` already render null as `--`, so this needs no special case;
            it is noted because a future "tidy" that defaulted them to 0 would
            silently turn an unrun session into a recorded one. */}
        <td className="num">{num(r.miles, 2)}</td>
        <td className="num">{clock(r.seconds)}</td>
        <td className="num">{pace(r.pace)}</td>
        <td className="num">
          {(r.hr_avg || "--") + " / " + (r.hr_max || "--")}
        </td>
        {/* `≈` MARKS AN ESTIMATE. Every tier except `stream` is one:
            `average-hr` prices from a listing's average (understating ~3%),
            `stream-disavowed` from the file's own summary after its stream
            was rejected against it. Keying on "not the measurement" means a
            future tier defaults to being marked -- an estimate reading as a
            measurement is the failure mode. */}
        <td className="num">
          {trimp?.trimp === null || trimp?.trimp === undefined
            ? "--"
            : (trimp.source !== "stream" ? "≈" : "") + num(trimp.trimp, 0)}
        </td>
        <td className="num">{num(r.cadence)}</td>
        <td className="num">
          {planned ? (
            // The status goes in the SCORE cell rather than in a tenth column,
            // because it answers that column's question: a planned run has no
            // score, and saying why beats an unexplained dash. `RUN_COLUMNS`
            // stays at nine.
            <span className="muted">{RUN_STATUS_LABEL[status]}</span>
          ) : (
            <>
              <Dot pct={r.pct} />{" "}
              {r.pct === null || r.pct === undefined ? (
                <span className="muted">--</span>
              ) : (
                <b>{Math.round(r.pct)}%</b>
              )}
            </>
          )}
        </td>
      </tr>
      {open ? (
        <tr>
          {/* Spans from RUN_COLUMNS, not a literal. The literal `9` here and
              the header array in TrainingPanel were two places to edit with
              nothing to notice they had diverged. */}
          <td colSpan={RUN_COLUMNS.length} id={panelId}>
            <RunDetail run={r} chart={chart} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
