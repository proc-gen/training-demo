"use client";

import { useState } from "react";
import type { PaceChart, PaceModelsCurrent, Week } from "@/lib/data/payload";
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
 * **THE MODEL DROPDOWN SWAPS THE RACE TABLE'S CURRENT COLUMN AND NOTHING
 * ELSE.** `pace_models_current` carries every registered model's race table at
 * the newest chart's own anchor; picking one shows an alternate model's
 * projections under that model's own name in the column heading, so a
 * projection never wears the confirmed chart's label. The BAND table always
 * renders the confirmed chart -- a training band is a percentage of vVO2max
 * and the alternate models have none to state -- and the week column is
 * untouched: it is the record the week was graded against, not a playground.
 * When the record is null (pace-models not installed) the control does not
 * render. `autoComplete="off"` for the same restore-across-reload reason the
 * week picker carries it.
 *
 * `RunDetail`'s planned readout still says which chart a SESSION's targets came
 * from, which is a different question -- a target is a number to act on, and
 * where it came from qualifies it.
 */
/** Dropdown order: the scored model first, cross-checks after. A constant
 * here because `publish.py`'s `sort_keys` alphabetises the record's keys --
 * the paces-rail row-order rule, and the same `FLAG_COMPONENT` /
 * `unmappedFlags()` shape: a token this list does not know is APPENDED,
 * never dropped, so a new model renders before anyone teaches the page
 * its name. */
const MODEL_ORDER = ["daniels_gilbert", "riegel", "cameron", "critical_speed"];

export function modelOrder(tokens: string[]): string[] {
  const known = MODEL_ORDER.filter((t) => tokens.includes(t));
  const unknown = tokens.filter((t) => !MODEL_ORDER.includes(t)).sort();
  return [...known, ...unknown];
}

export function PaceRail({
  week,
  current,
  models,
}: {
  week: Week;
  current?: PaceChart | null;
  models?: PaceModelsCurrent | null;
}) {
  const [model, setModel] = useState("");
  const chart = week.pace_chart;
  const carried = week.pace_chart_is_carried_forward === true;
  const showWeek = !!chart && !carried;
  if (!chart && !current) return null;

  const tables = models?.models ?? {};
  const names = modelOrder(Object.keys(tables));
  const picked = model && tables[model] ? tables[model] : null;

  return (
    <aside className="rail" aria-label="Training paces">
      <h2>Paces</h2>
      <PaceBandTable week={chart} current={current} showWeek={showWeek} />
      {names.length > 0 && (
        <label className="field">
          <span>Race times</span>
          <select
            value={picked ? model : ""}
            autoComplete="off"
            aria-label="Race time model"
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Confirmed chart</option>
            {names.map((n) => (
              <option value={n} key={n}>
                {tables[n]?.label ?? n}
              </option>
            ))}
          </select>
        </label>
      )}
      <RacePaceTable
        week={chart}
        current={picked ? { race_paces: picked.race_paces } : current}
        showWeek={showWeek}
        currentLabel={picked ? (picked.label ?? model) : "Current"}
      />
    </aside>
  );
}
