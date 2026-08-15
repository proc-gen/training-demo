"use client";

import { clock, pace } from "@/lib/data/format";
import type { PaceChart, RacePace } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { raceRows } from "../data/paceRows";

/** The week's estimated race times beside today's.
 *
 * These are the PROGNOSIS at the effective VO2max the chart records -- what the
 * model expects, not what a clock said. They are also what repetition and
 * interval work is graded against, so a reader checking a rep target against
 * `800m` pace is reading the same number the grader used.
 */
export function RacePaceTable({
  week,
  current,
  showWeek,
}: {
  week?: PaceChart | null;
  current?: PaceChart | null;
  showWeek: boolean;
}) {
  const rows = raceRows(showWeek ? week : null, current);
  if (!rows.length) return null;

  return (
    <Table
      raw
      headers={[
        { label: "Race" },
        { label: "This week", num: true },
        { label: "Current", num: true },
      ]}
    >
      {rows.map((r) => (
        <tr key={r.key}>
          <td>{r.label}</td>
          <td className="num">{showWeek ? raceText(r.week) : "--"}</td>
          <td className="num">{raceText(r.current)}</td>
        </tr>
      ))}
    </Table>
  );
}

/** A prognosis as `18:06 @ 5:49/mi`.
 *
 * **`tempo` HAS NO RACE TIME AND MUST NOT BE GIVEN ONE.** It is the Daniels
 * 60-80 minute RANGE, carried as a pace reference and scored by nothing, so it
 * renders `6:12-6:27/mi` alone. Inventing a duration for it would publish a
 * prediction the chart does not make.
 */
export function raceText(r: RacePace | undefined): string {
  if (!r) return "--";
  if (r.display) return r.display;
  const { seconds: s, sec_per_mi: p } = r;
  if (s !== null && s !== undefined) {
    return p ? `${clock(s)} @ ${pace(p)}/mi` : clock(s);
  }
  const { fast_sec_per_mi: f, slow_sec_per_mi: sl } = r;
  if (f !== null && f !== undefined && sl !== null && sl !== undefined) {
    return `${pace(Math.min(f, sl))}-${pace(Math.max(f, sl))}/mi`;
  }
  return p ? `${pace(p)}/mi` : "--";
}
