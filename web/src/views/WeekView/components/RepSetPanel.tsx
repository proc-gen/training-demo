"use client";

import { clock, distIn, distUnit, num, pace } from "@/lib/data/format";
import {
  paceChartBand,
  pairOf,
  type PaceChart,
  type RepRow,
  type RepSet,
} from "@/lib/data/payload";
import { Note } from "@/lib/ux/primitives/Note";
import { Table } from "@/lib/ux/primitives/Table";
import { Verdict } from "@/lib/ux/primitives/Verdict";
import { RepChartPanel } from "./RepChartPanel";

/** `0:37-0:42 ±1` — the whole-second target and its allowance.
 *
 * The two are separate on purpose: `36-43` is the band, and printing only that
 * makes a one-second tolerance read as a target with none, which is exactly how
 * `0:35 faster than 800m pace 0:36` was read. A collapsed range (a set naming
 * one race pace) prints as a single time.
 */
function repTarget(x: RepRow): string {
  const t = x.target;
  if (!t || t.length !== 2) return "--";
  const [lo, hi] = t;
  const range = lo === hi ? clock(lo) : `${clock(lo)}-${clock(hi)}`;
  return x.tolerance ? `${range} ±${x.tolerance}s` : range;
}

/** One prescribed block: its laps, and its reps against the criterion.
 *
 * WHICH COLUMNS MEAN ANYTHING IS READ OFF THE PAYLOAD. `set.scored_on` comes
 * from `A.SET_CRITERION`, the grader's own single definition of what scores each
 * mode. The local `PACE_SCORED` list this replaced named three modes and omitted
 * `alternation` -- which `score_alternation` judges on pace -- so an alternation
 * set rendered three heart-rate columns for a criterion nothing scores against.
 * Any list here is a copy of a vocabulary that lives in Python and drifts.
 *
 * Heart rate lags alactic and near-maximal work entirely, so on a pace-scored
 * set it is not the measurement and does not enter the score. It is still
 * CAPTURED, and the chart's HR view will show it with an explicit note saying
 * nothing scored it -- which is different from hiding it.
 *
 * `hr_min` IS GONE from the table. Inside a rep it is the lowest sample in the
 * split, which on the opening rep is the tail of the warmup -- rep 1 of
 * 2026-07-28 reads 83 against a 143 average. It is the RECOVERY criterion, and
 * the recovery verdict already states it in words.
 *
 * TWO ROUTES TO THE BAND'S NUMBERS, for disjoint sets of modes. `st.band` is a
 * band NAME ("rep_3min") and the numbers for it live only in the week's pace
 * chart, which is why the chart is threaded down here -- indexing the name as a
 * pair yields "r" and paints every rep out of band. A pace-scored set has no
 * name to look up, because its band is built from race paces, so the grader
 * emits `band_sec_per_mi` directly. Exactly one is ever non-null per set.
 */
export function RepSetPanel({
  set,
  chart,
  titled = true,
}: {
  set: RepSet;
  chart: PaceChart | null | undefined;
  /** False for a lone set, whose heading would restate the explanation above
   *  it a third time. See `SessionDetail`. */
  titled?: boolean;
}) {
  const rows = set.rep_rows ?? [];
  if (!rows.length) return null;

  // THE BAND THAT WAS SCORED, in preference to the reference range beside it.
  // `band_pace` is the projection of the whole-second band each rep was
  // actually judged against; `band_sec_per_mi` is the unrounded race-pace range
  // it was derived from, and the two differ by up to a second per mile. The
  // chart shades what the grader applied, or the marks and the ✓ column
  // disagree about the same rep.
  const pair = set.band_pace ?? set.band_sec_per_mi;
  const range =
    paceChartBand(chart, set.band) ??
    (pair && pair.length === 2
      ? ([Math.min(...pair), Math.max(...pair)] as [number, number])
      : null);
  const showHr = set.scored_on !== "pace";
  // Each rep carries its OWN band where the grader resolved one -- a mixed-
  // distance set has a different one per rep length, and `set.band_pace` is
  // null exactly then.
  const reps = rows
    .filter((x) => x.work)
    .map((x) => ({ ...x, band: pairOf(x.band_pace) }));
  // The column appears only where the grader resolved a target. An HR-scored
  // set has none, and an AUTHORED band states none -- it is two numbers with
  // the tolerance already inside them, so a target column there would print a
  // midpoint nobody prescribed.
  const anyTarget = rows.some((x) => x.target && x.target.length === 2);
  // One unit for the whole column -- see `distUnit`. A rep set of 600s and 200m
  // jogs stays in metres, which is the unit the prescription itself uses.
  const unit = distUnit(rows.map((x) => x.dist_km));

  // Row index -> rep number. Only WORK laps are numbered, so the recoveries
  // between them do not consume a number and "rep 4" is the fourth rep rather
  // than the seventh lap. Built up front rather than counted during the render,
  // which is a reassignment mid-render.
  const repNumber = new Map<number, number>();
  rows.forEach((x, i) => {
    if (x.work) repNumber.set(i, repNumber.size + 1);
  });

  return (
    <div>
      {titled ? (
        <p className="sm-title">
          {(set.mode || "set") + " — " + (set.ceiling || set.band_display || "--")}
          {set.pct === null || set.pct === undefined
            ? ""
            : " · " + Math.round(set.pct) + "%"}
        </p>
      ) : null}

      <Table
        raw
        headers={[
          { label: "#", num: true },
          { label: "Kind" },
          { label: "Time", num: true },
          { label: "Distance", num: true },
          // WHAT THE REP WAS ASKED TO RUN, in the unit the athlete reasons in.
          // It was nowhere on the page: the ✓ said whether a rep made its band
          // and nothing said what the band was, so a set could score 100% with
          // a rep visibly outside the chart under it and no number on the row
          // to check either claim against.
          ...(anyTarget ? [{ label: "Target", num: true }] : []),
          { label: "Pace", num: true },
          { label: "Cadence", num: true },
          ...(showHr
            ? [
                { label: "HR avg", num: true },
                { label: "HR max", num: true },
              ]
            : []),
          { label: "" },
        ]}
      >
        {rows.map((x, i) => {
          const isRep = !!x.work;
          return (
            <tr key={i}>
              <td className="num sec">
                {x.suspect ? "?" : isRep ? String(repNumber.get(i)) : ""}
              </td>
              <td>{isRep ? "rep" : x.suspect ? "suspect" : "recovery"}</td>
              <td className="num">{clock(x.dur)}</td>
              {/* The rep's own NAME where the grader published one. A
                  prescription states "400m"; re-deriving it from dist_km lands
                  on "0.40 mi", which is a distance rather than the thing the
                  plan asked for. */}
              <td className="num">{x.label || distIn(x.dist_km, unit)}</td>
              {anyTarget ? (
                <td className="num">{repTarget(x)}</td>
              ) : null}
              <td className="num">{x.pace ? pace(x.pace) : "--"}</td>
              <td className="num">{num(x.cad)}</td>
              {showHr ? (
                <>
                  <td className="num">{x.hr_avg ?? "--"}</td>
                  <td className="num">{x.hr_max ?? "--"}</td>
                </>
              ) : null}
              <td>
                <Verdict v={x.ok} pass="✓" fail="✗" none="–" />{" "}
                <span className="sec">{x.reason || ""}</span>
              </td>
            </tr>
          );
        })}
      </Table>

      <RepChartPanel
        points={reps}
        scoredOn={set.scored_on}
        band={range}
        /* THE CAPTION NAMES THE REGION THAT IS DRAWN. `band_display` is built
           from the unrounded reference range, which differs from the scored
           band by up to a second per mile -- close enough to look right and
           wrong enough that a rep on the edge reads as mis-coloured. Where a
           per-rep band exists the caption comes from it; where one does not
           (an HR-scored set, or a mixed set with no single region) the grader's
           own string still applies. */
        bandDisplay={
          set.band_pace && range
            ? `${pace(range[0])}-${pace(range[1])}/mi`
            : set.band_display
        }
        hrCeilings={set.hr_ceiling ?? []}
        ceilingLabel={set.ceiling}
      />

      {/* Fires when a band was EXPECTED and could not be resolved -- either the
          set names one the chart cannot supply, or it is pace-scored and so is
          judged against race paces. Silence here would leave every rep drawn
          unjudged with nothing saying why. */}
      {!range && (set.band || set.scored_on === "pace") ? (
        <Note>
          No pace chart for this week, so the band{" "}
          {set.band ? set.band + " " : ""}could not be drawn — every rep is shown
          unjudged.
        </Note>
      ) : null}
    </div>
  );
}
