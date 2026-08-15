"use client";

import { clock, distIn, distUnit, num, pace } from "@/lib/data/format";
import type { Lap } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";

/** The device's own laps for a run that publishes no scored segment table.
 *
 * WHY THIS EXISTS AT ALL: a continuous run published nothing per-segment until
 * 2026-08-11, so an easy run on this page was a single row that could not be
 * opened. The laps were in `derived/activities/` the whole time; only the
 * absence of a consumer kept them off the page.
 *
 * NO VERDICT COLUMN, deliberately. These laps were not warmup-stripped, not
 * rep-detected and not judged -- they are what the watch recorded. A tick beside
 * one would invent a criterion nobody stated. Where a run HAS been judged, its
 * `rep_rows` are shown instead and the grader never publishes both.
 *
 * EVERY LAP STAYS, INCLUDING THE RECOVERIES. Where the file declares which were
 * work, they get a rep number -- which is not a verdict, it is the athlete's own
 * Runalyze markup. The chart above may plot the work laps alone (see
 * `RunDetail`); this table is the place nothing is dropped from.
 */
export function LapTable({ laps }: { laps: Lap[] }) {
  if (!laps.length) return null;
  // ONE UNIT FOR THE WHOLE COLUMN. Chosen per value it read
  // `1.00 mi, 1.00 mi, 398m`, where the short last lap looked like a different
  // kind of measurement rather than a shorter one.
  const unit = distUnit(laps.map((l) => l.dist_km));
  const declared = laps.some((l) => l.work);
  // Lap index -> rep number. ONLY work laps are numbered, so a recovery does
  // not consume a number and "rep 2" is the second rep rather than the fourth
  // lap. Built up front rather than counted during the render, which would be
  // a reassignment mid-render -- the same shape `RepSetPanel` uses.
  const repNumber = new Map<number, number>();
  laps.forEach((l, i) => {
    if (l.work) repNumber.set(i, repNumber.size + 1);
  });
  return (
    <Table
      raw
      headers={[
        { label: "#", num: true },
        ...(declared ? [{ label: "" }] : []),
        { label: "Time", num: true },
        { label: "Distance", num: true },
        { label: "Pace", num: true },
        { label: "Cadence", num: true },
        { label: "HR avg/max", num: true },
      ]}
    >
      {laps.map((lap, i) => (
        <tr key={i}>
          <td className="num sec">{lap.index ?? i + 1}</td>
          {declared ? (
            <td className="sec">
              {lap.work ? "rep " + repNumber.get(i) : (lap.declared ?? "")}
            </td>
          ) : null}
          <td className="num">{clock(lap.dur)}</td>
          <td className="num">{distIn(lap.dist_km, unit)}</td>
          <td className="num">{lap.pace ? pace(lap.pace) + "/mi" : "--"}</td>
          <td className="num">{num(lap.cad)}</td>
          <td className="num">
            {(lap.hr_avg ?? "--") + " / " + (lap.hr_max ?? "--")}
          </td>
        </tr>
      ))}
    </Table>
  );
}
