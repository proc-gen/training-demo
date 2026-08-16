"use client";

import { useId, useState } from "react";

import { RepHrChart, type HrPoint } from "@/lib/ux/charts/RepHrChart";
import { RepPaceChart, type RepPoint } from "@/lib/ux/charts/RepPaceChart";
import { Legend } from "@/lib/ux/primitives/Legend";
import { Note } from "@/lib/ux/primitives/Note";
import { Tabs, tabId } from "@/lib/ux/primitives/Tabs";

export type ChartPoint = RepPoint & HrPoint;

/** Pace and heart rate for one set or run, whichever scored it opening first.
 *
 * THE DEFECT THIS FIXES: every session plotted PACE, including sub-T, which is
 * scored on heart rate. The chart was answering a question the grader had not
 * asked, and the reader had no way to see the criterion that actually produced
 * the number above it.
 *
 * THE DEFAULT IS READ OFF THE PAYLOAD, never inferred from a role or a mode name
 * in this file. `scored_on` comes from `A.SET_CRITERION`, the grader's own single
 * definition -- `subt` opens on HR, every pace-scored mode opens on pace, and a
 * continuous run opens on HR because `ceiling_tiers` is what scored it. The
 * local mode list this replaced had `alternation` on the wrong side.
 *
 * A view with fewer than two plottable points is DROPPED rather than rendered
 * empty, and one remaining view renders NO STRIP -- the same "one tab is not a
 * choice" rule `WeekCard` states. So a repetition set with no heart rate shows
 * one chart and no toggle, which is honest, where an empty second tab would read
 * as data that failed to load.
 */
export function RepChartPanel({
  points,
  scoredOn,
  band,
  bandDisplay,
  hrCeilings,
  ceilingLabel,
  judged = true,
  unit = "rep",
  wholeRunNote,
  pointsNote,
}: {
  points: ChartPoint[];
  /** "hr" | "pace" | null, straight off the grader. */
  scoredOn?: string | null;
  band: [number, number] | null;
  bandDisplay?: string | null;
  hrCeilings?: number[];
  ceilingLabel?: string | null;
  /** False where the grader judged the RUN rather than each mark -- a
   *  continuous run is scored on its whole duration under the ceiling. */
  judged?: boolean;
  unit?: string;
  /** What the run was scored on, where the marks carry no verdict of their own.
   *  HR-SPECIFIC PROSE, so it renders in the heart-rate view alone. */
  wholeRunNote?: string | null;
  /** WHICH MARKS ARE ON THE CHART AT ALL, so it renders in BOTH views.
   *
   *  Separate from `wholeRunNote` because that one describes the heart-rate
   *  rule and would read as nonsense over a pace plot. This one is about the
   *  points, which is true of every view -- and the session it was added for,
   *  2026-08-14's hill sprints, has no heart-rate ceiling and therefore opens
   *  on PACE. Folding it into `wholeRunNote` would have left the one chart that
   *  narrows its points saying nothing about it. */
  pointsNote?: string | null;
}) {
  const panelId = useId();
  const paced = points.filter((p) => p.pace);
  const withHr = points.filter((p) => p.hr_avg);

  const views: { key: string; label: string }[] = [];
  if (paced.length > 1) views.push({ key: "pace", label: "Pace" });
  if (withHr.length > 1) views.push({ key: "hr", label: "Heart rate" });

  const preferred = scoredOn === "hr" ? "hr" : "pace";
  const [chosen, setChosen] = useState(preferred);
  // The selection outlives a re-render with different points, exactly as the
  // week card's tab outlives the week, so fall back rather than showing nothing.
  const active = views.some((v) => v.key === chosen) ? chosen : views[0]?.key;

  if (!views.length) return null;

  return (
    <div className="rep-chart">
      {views.length > 1 ? (
        <Tabs
          items={views}
          active={active as string}
          onSelect={setChosen}
          label="chart measurement"
          panelId={panelId}
          className="in-card"
        />
      ) : null}

      <div
        id={panelId}
        role={views.length > 1 ? "tabpanel" : undefined}
        aria-labelledby={
          views.length > 1 ? tabId(panelId, active as string) : undefined
        }
      >
        {/* THE LEGEND SITS UNDER THE CHART. Above it, a reader meets a colour
            key before anything is coloured and has to hold it in mind; under
            it, the marks are already on screen to match against. */}
        {active === "hr" ? (
          <>
            <RepHrChart
              points={withHr}
              ceilings={hrCeilings ?? []}
              ceilingLabel={ceilingLabel}
              judged={judged}
              unit={unit}
            />
            {judged ? (
              <Legend
                items={[
                  { color: "var(--series-1)", label: `${unit} at or under the ceiling` },
                  { color: "var(--critical)", label: `${unit} over it` },
                  { color: "var(--text-muted)", label: "not judged" },
                ]}
              />
            ) : null}
            {wholeRunNote ? <Note>{wholeRunNote}</Note> : null}
            {!(hrCeilings ?? []).length ? (
              <Note>
                Heart rate is captured here and never scored — this set is judged
                on pace, so the chart shows the measurement with no rule to read
                it against.
              </Note>
            ) : null}
          </>
        ) : (
          <>
            <RepPaceChart
              reps={paced}
              band={band}
              bandDisplay={bandDisplay}
              unit={unit}
            />
            {/* Two entries, not three: the shaded region carries its own
                in-chart label, and a third swatch in the same blue reads as a
                second meaning for one colour. */}
            {band && judged ? (
              <Legend
                items={[
                  { color: "var(--series-1)", label: `${unit} inside the prescribed band` },
                  { color: "var(--critical)", label: `${unit} outside it` },
                ]}
              />
            ) : null}
            {/* Only where the marks carry no verdict at all -- a continuous
                run. A rep set with an unresolvable band has its own, more
                specific note from `RepSetPanel`, and two would say the same
                thing twice. */}
            {!band && !judged ? (
              <Note>
                No pace band was prescribed for this run, so every {unit} is
                plotted unjudged.
              </Note>
            ) : null}
          </>
        )}
        {/* OUTSIDE THE VIEW SWITCH, because it describes which marks are on the
            chart and that is true of every view. */}
        {pointsNote ? <Note>{pointsNote}</Note> : null}
      </div>
    </div>
  );
}
