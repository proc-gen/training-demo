"use client";

import type { PaceChart, Week } from "@/lib/data/payload";
import { PaceBandTable } from "./PaceBandTable";
import { RacePaceTable } from "./RacePaceTable";

/** The whole pace chart, beside the week rather than inside its sessions.
 *
 * Until now the chart reached the reader one target at a time, inside whichever
 * session happened to use it -- so the table the athlete actually trains off
 * was the one thing the report card did not show.
 *
 * **THE WEEK COLUMN IS BLANK FOR A WEEK WITH NO CHART OF ITS OWN**, which is
 * every week authored ahead of the one being lived: a chart is confirmed as its
 * week CLOSES. The condition is the published `pace_chart_is_carried_forward`
 * and not a date comparison here -- Python decided which chart graded the week
 * and the page must not reach a second answer.
 *
 * **IT CARRIES NO PROSE AT ALL, AND THAT IS THE POINT OF IT.** It had a
 * subtitle naming both charts, which the columns already said; that went on
 * 2026-08-14 and a sentence explaining the blank column went in its place,
 * which was the same mistake one line down. The athlete: *"it's clear that the
 * week is a future week already, get rid of the sentence about no pace chart
 * existing yet."* A column of `--` on a week whose every run reads *Not yet
 * completed* is not ambiguous, and a rail that has to explain itself is one
 * more expected state on a page that just had three of them removed.
 *
 * `RunDetail`'s planned readout still says which chart a SESSION's targets came
 * from, which is a different question -- a target is a number to act on, and
 * where it came from qualifies it.
 */
export function PaceRail({
  week,
  current,
}: {
  week: Week;
  current?: PaceChart | null;
}) {
  const chart = week.pace_chart;
  const carried = week.pace_chart_is_carried_forward === true;
  const showWeek = !!chart && !carried;
  if (!chart && !current) return null;

  return (
    <aside className="rail" aria-label="Training paces">
      <h2>Paces</h2>
      <PaceBandTable week={chart} current={current} showWeek={showWeek} />
      <RacePaceTable week={chart} current={current} showWeek={showWeek} />
    </aside>
  );
}
