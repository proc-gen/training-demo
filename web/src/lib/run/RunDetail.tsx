"use client";

import { useId, useState } from "react";

import { paceChartBand, type PaceChart, type RunResult } from "@/lib/data/payload";
import { Tabs } from "@/lib/ux/primitives/Tabs";
import { isPlanned } from "./data/runStatus";
import { LapTable } from "./LapTable";
import { PlannedReadout } from "./PlannedReadout";
import { RepChartPanel } from "./RepChartPanel";
import { RunScoreWhy } from "./RunScoreWhy";
import { SessionDetail } from "./SessionDetail";

/** Everything inside one run's expansion.
 *
 * THE ORDER IS THE ARGUMENT: why the score is what it is, then the evidence
 * behind it. A reader opening a row wants the verdict explained first and the
 * lap-by-lap second; the reverse makes them scroll past a table to find out what
 * they are looking at.
 *
 * A run shows EITHER its judged sets or its raw laps, never both, because the
 * grader publishes only one -- a session with `rep_rows` has been
 * warmup-stripped, rep-detected and judged, which is strictly more than a lap
 * table knows, and a race publishes per-mile splits cut from the distance
 * stream. Two segment tables for one run is a reader deciding which to believe.
 *
 * A CONTINUOUS RUN GETS A CHART TOO. Its laps carry heart rate and its
 * `ceiling_tiers` carry the rule that scored it, which is the same pairing a
 * sub-T set has -- so an easy run is plotted against the ceiling it was judged
 * on rather than being left as a table of numbers.
 *
 * PLANNED | ACTUAL. A completed run can be toggled back to what was asked for.
 * A planned run has no actual side and shows no strip -- an empty tab that
 * discloses nothing is worse than no tab, and it would imply a measurement
 * exists somewhere.
 */
export function RunDetail({
  run,
  chart,
}: {
  run: RunResult;
  chart: PaceChart | null | undefined;
}) {
  const panelId = useId();
  const planned_ = isPlanned(run);
  const [tab, setTab] = useState(planned_ ? "planned" : "actual");
  const planned = run.planned;

  // A planned run has nothing else to show, so the strip would offer one
  // choice. A completed run with no `planned` block is a record published
  // before 2026-08-12 -- it renders exactly as it always did rather than
  // growing an empty tab.
  const showTabs = !planned_ && !!planned;
  const showPlanned = !!planned && (planned_ || tab === "planned");

  const sets = run.detail?.sets ?? [];
  const hasReps = sets.some((s) => (s.rep_rows ?? []).length);
  const laps = run.detail?.laps ?? [];
  // WHERE THE FILE DECLARES ITS REPS, THE CHART PLOTS THOSE ALONE. The table
  // below still lists every lap. This is `RepSetPanel`'s own rule --
  // `.filter((x) => x.work)` -- so the judged and unjudged paths agree about
  // what a chart of a workout is a chart OF.
  //
  // It is not cosmetic. 2026-08-14's hill sprints are three ~7-second efforts
  // at ~6:30/mi separated by two-minute walks back down at 63:31/mi and
  // 39:22/mi; on one axis the reps collapse into the bottom of the plot and the
  // session reads as four minutes of walking.
  const repLaps = laps.filter((l) => l.work);
  const points = repLaps.length ? repLaps : laps;
  const hiddenLaps = laps.length - points.length;
  // `ceiling_tiers` is [[through_seconds, bpm], ...]; only the bpm is a rule.
  const ceilings = (run.planned?.ceiling_tiers ?? [])
    .map((t) => t?.[1])
    .filter((v): v is number => typeof v === "number");

  // THE PRESCRIBED BAND, FOR A CONTINUOUS RUN'S PACE VIEW. This said "an easy
  // run states a duration, not a pace" and passed `band={null}` until
  // 2026-08-12, which was true about the CRITERION and wrong about the plan:
  // the week's chart has carried `bands.easy` all along, taken verbatim from
  // the athlete's own Runalyze training-paces table. The band is drawn now, and
  // `RepChartPanel` opens on the HR view regardless -- that is still the
  // measurement the run was scored on.
  const referenceBand = planned?.band_is_reference
    ? paceChartBand(chart, planned.band)
    : null;

  return (
    <div className="run-detail">
      {showTabs ? (
        <Tabs
          items={[
            { key: "actual", label: "Actual" },
            { key: "planned", label: "Planned" },
          ]}
          active={tab}
          onSelect={setTab}
          label="Planned or actual"
          panelId={panelId}
          className="in-card"
        />
      ) : null}

      <div id={panelId}>
        {showPlanned ? (
          <PlannedReadout planned={planned!} />
        ) : (
          <>
            <RunScoreWhy run={run} />

            {hasReps ? (
              <SessionDetail sets={sets} chart={chart} />
            ) : laps.length ? (
              <>
                <LapTable laps={laps} />
                <RepChartPanel
                  points={points}
                  // A continuous run is scored on time under a heart-rate
                  // ceiling, so that is the view it opens on. Its pace view now
                  // carries the band the plan intended, one click away.
                  scoredOn={ceilings.length ? "hr" : "pace"}
                  band={referenceBand}
                  bandDisplay={planned?.band_display ?? undefined}
                  hrCeilings={ceilings}
                  ceilingLabel={run.planned?.ceiling}
                  unit={repLaps.length ? "rep" : "lap"}
                  // NO PER-LAP VERDICT EXISTS, and claiming otherwise was a real
                  // defect: every lap rendered "not judged", which reads as a
                  // grader that failed to assess them. It scored the WHOLE run
                  // -- one point per second under the ceiling -- so the laps are
                  // a measurement shown against the rule, not a set of
                  // individual verdicts.
                  judged={false}
                  // NO SILENT TRUNCATION. A chart that quietly drops the
                  // recoveries reads as a complete account of the session, so it
                  // says how many it left out and where to find them. Its OWN
                  // prop, not folded into `wholeRunNote`: that one is
                  // heart-rate prose shown in the HR view alone, and the session
                  // this exists for has no HR ceiling and opens on pace.
                  pointsNote={
                    hiddenLaps > 0
                      ? `Only the ${points.length} lap(s) this file marks as ` +
                        `work are plotted; the ${hiddenLaps} recovery lap(s) ` +
                        "are in the table above."
                      : null
                  }
                  wholeRunNote={
                    ceilings.length
                      ? "Each mark is a lap's average heart rate. The run is " +
                        "scored on its whole duration at or below the ceiling, " +
                        "not lap by lap, so no single lap passes or fails." +
                        (referenceBand
                          ? " The pace view shows the band the plan intended, " +
                            "which is a reference and not what scored the run."
                          : "")
                      : null
                  }
                />
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
