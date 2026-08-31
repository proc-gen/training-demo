"use client";

import { useId, useState } from "react";

import { paceChartBand, type PaceChart, type RunResult } from "@/lib/data/payload";
import { Tabs } from "@/lib/ux/primitives/Tabs";
import { CustomLapsButton } from "./CustomLapsButton";
import { raceChartPoints } from "./data/raceSplits";
import { isPlanned } from "./data/runStatus";
import { LapTable } from "./LapTable";
import { PlannedReadout } from "./PlannedReadout";
import { RaceSplitTable } from "./RaceSplitTable";
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
 * A run shows EXACTLY ONE segment table, because the grader publishes exactly
 * one. Three kinds, and which arrives says what the run was:
 *
 *   - a session with `rep_rows` has been warmup-stripped, rep-detected and
 *     JUDGED, which is strictly more than a lap table knows;
 *   - a RACE publishes per-mile splits cut from the distance stream, because it
 *     is rarely lapped on the mile marks -- `attach_laps()` withholds the device
 *     laps for exactly that reason;
 *   - everything else gets the laps the watch recorded.
 *
 * Two segment tables for one run is a reader deciding which to believe.
 *
 * THE RACE ARM WAS DESCRIBED HERE AND NEVER BUILT, and this comment is where the
 * gap hid: it explained why a race gets splits rather than laps while the branch
 * below had two arms, so a race matched neither and fell through to `null`. The
 * athlete found it by opening the Local 5k and asking why laps never show
 * for races. Eleven completed races had been publishing their splits the whole
 * time.
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
  // Present ONLY on a completed race, and null on one whose file carried no
  // distance stream -- `race_report()` returns None there rather than guessing
  // splits, so such a race falls on to the laps arm like any other run.
  const race = run.detail?.race;
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

  /* CUSTOM LAPS SITS DIRECTLY UNDER THE TABLE, which is the athlete's own
   * placement: it shipped after the whole branch below, so it landed under the
   * chart AND under the chart's footnote, where it read as an afterthought.
   *
   * ONE `const`, THREE POSITIONS. The branch is an if/else chain, so exactly
   * one of them renders and this is one element in one place at runtime --
   * while writing the call out three times would be three things free to drift
   * in what they pass.
   *
   * A PLANNED run never reaches any of them; it is on the other side of
   * `showPlanned`, which is right, because a session nobody has run has no
   * samples to cut. */
  const customLaps = run.runalyze_id ? (
    <CustomLapsButton activityId={Number(run.runalyze_id)} />
  ) : null;

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
              <>
                <SessionDetail sets={sets} chart={chart} />
                {/* AFTER THE WHOLE SESSION, and that is the honest answer here
                    rather than an oversight. This arm has no single laps table:
                    `SessionDetail` renders a `RepSetPanel` per set, each with
                    its own table and its own chart, so "under the laps table"
                    has no referent inside it. */}
                {customLaps}
              </>
            ) : race ? (
              <>
                <RaceSplitTable race={race} />
                {customLaps}
                <RepChartPanel
                  points={raceChartPoints(race)}
                  // A race is read for its splits, so that is the view it opens
                  // on -- and unlike every other run there is no alternative
                  // criterion to defer to, because nothing scored it.
                  scoredOn="pace"
                  // NO BAND AND NO CEILING LINE. A race has no criterion at all:
                  // `hr.race` does not exist and a prognosis is a projection,
                  // not a rule the run was held to. Drawing either would put a
                  // verdict under marks the grader deliberately did not judge.
                  band={null}
                  hrCeilings={[]}
                  // Stronger here than on a continuous run, which at least has a
                  // whole-run ceiling: a race is scored by NOTHING, so no mark
                  // can pass or fail and none may render as though it could.
                  judged={false}
                  unit="split"
                  // No note on either view. `RunScoreWhy` states "Reported,
                  // never scored" immediately above, and repeating it under the
                  // chart is the page-prose the athlete has asked to remove
                  // three times over.
                />
              </>
            ) : laps.length ? (
              <>
                <LapTable laps={laps} />
                {customLaps}
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
