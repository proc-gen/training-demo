"use client";

import { clock, pace } from "@/lib/data/format";
import { paceChartBand, type PaceChart, type RepSet } from "@/lib/data/payload";
import { RepPaceChart } from "@/lib/ux/charts/RepPaceChart";
import { Legend } from "@/lib/ux/primitives/Legend";
import { Note } from "@/lib/ux/primitives/Note";
import { Table } from "@/lib/ux/primitives/Table";
import { Verdict } from "@/lib/ux/primitives/Verdict";

/** One prescribed block: its laps, and its reps against the band.
 *
 * `st.band` is the band's NAME ("rep_3min"); the NUMBERS live only in the
 * week's pace chart, which is why the chart is threaded down here and resolved
 * with `paceChartBand`. Indexing the name as a pair yields "r" and paints every
 * rep out of band.
 */
export function RepSetPanel({
  set,
  chart,
}: {
  set: RepSet;
  chart: PaceChart | null | undefined;
}) {
  const rows = set.rep_rows ?? [];
  if (!rows.length) return null;

  const range = paceChartBand(chart, set.band);
  const reps = rows.filter((x) => x.work && x.pace);

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
      <p className="sm-title">
        {(set.mode || "set") + " — band " + (set.band_display || "--")}
        {set.pct === null || set.pct === undefined
          ? ""
          : " · " + Math.round(set.pct) + "%"}
      </p>

      <Table
        headers={[
          { label: "#", num: true },
          { label: "Kind" },
          { label: "Time", num: true },
          { label: "Pace", num: true },
          { label: "HR avg", num: true },
          { label: "HR max", num: true },
          { label: "HR min", num: true },
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
              <td className="num">{x.pace ? pace(x.pace) : "--"}</td>
              <td className="num">{x.hr_avg ?? "--"}</td>
              <td className="num">{x.hr_max ?? "--"}</td>
              {/* HR min on RECOVERIES only. Inside a rep it is the lowest
                  sample in the split, which on the opening rep is the tail
                  of the warmup -- rep 1 of 2026-07-28 reads 83 against a
                  143 average. It is the recovery criterion, so it is shown
                  where it is the criterion. */}
              <td className="num">
                {isRep || x.hr_min === null || x.hr_min === undefined
                  ? ""
                  : x.hr_min}
              </td>
              <td>
                <Verdict v={x.ok} pass="✓" fail="✗" none="–" />{" "}
                <span className="sec">{x.reason || ""}</span>
              </td>
            </tr>
          );
        })}
      </Table>

      {reps.length > 1 ? (
        <>
          {/* Two entries, not three: the shaded region carries its own
              in-chart label, and a third swatch in the same blue read as a
              second meaning for one colour. */}
          <Legend
            items={[
              { color: "var(--series-1)", label: "rep inside the prescribed band" },
              { color: "var(--critical)", label: "rep outside it" },
            ]}
          />
          <RepPaceChart reps={reps} band={range} bandDisplay={set.band_display} />
          {!range && set.band ? (
            <Note>
              No pace chart for this week, so the band {set.band} could not be
              drawn — every rep is shown unjudged.
            </Note>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
