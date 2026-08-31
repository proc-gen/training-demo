"use client";

import { clock, signed } from "@/lib/data/format";
import type { RaceDetail } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { halvesShape, splitLabel } from "./data/raceSplits";

/** Per-mile splits and the two halves of a completed race.
 *
 * WHY A RACE HAS NO LAP TABLE AND THIS INSTEAD. `grade_week.attach_laps()`
 * returns early on `detail.race`, and its own comment says why: a race is rarely
 * lapped on the mile marks, so the device's laps are the athlete's
 * watch-glances. `race_report()` cuts real splits out of the distance and time
 * streams instead. That data has been published on every completed race since
 * the grader was written; until 2026-08-30 NOTHING RENDERED IT, so a race row
 * opened onto the "Not scored" note and stopped -- which is what the athlete
 * found by asking why laps never show for races.
 *
 * NO VERDICT COLUMN, and the claim is stronger than `LapTable`'s. That one holds
 * laps nobody judged; this holds splits nothing COULD judge -- a race is
 * reported and never scored, because grading one against an easy-run ceiling
 * scores near zero for doing exactly what was intended.
 *
 * THE HALVES ARE NOT DERIVABLE FROM THE ROWS ABOVE THEM, which is why they are
 * carried rather than recomputed here. `race_report` bisects the distance stream
 * for the true halfway metre; interpolating across the mile splits assumes
 * constant pace inside whichever mile that point lands in. On the 2026-08-30 5k
 * the two methods give +3.1% and +1.4% for one race, and it was the
 * hand-interpolated figure that reached a tracked file.
 *
 * A ONE-SPLIT RACE STILL RENDERS. 2025-02-23's indoor mile yields a single
 * split, and `races.md` says outright that for a mile you "read the halves
 * instead" -- so the halves line is the whole reading there, not a footnote.
 */
export function RaceSplitTable({ race }: { race: RaceDetail }) {
  const splits = race.splits ?? [];
  const h = race.halves;
  if (!splits.length && !h) return null;
  const shape = halvesShape(h?.delta_pct);

  return (
    <>
      {splits.length ? (
        <Table
          raw
          headers={[
            { label: "Split" },
            { label: "Time", num: true },
            { label: "HR avg/max", num: true },
          ]}
        >
          {splits.map((s, i) => (
            <tr key={i}>
              <td className="sec">{splitLabel(s)}</td>
              <td className="num">{clock(s.seconds)}</td>
              <td className="num">
                {(s.hr_avg ?? "--") + " / " + (s.hr_max ?? "--")}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}
      {h ? (
        <p className="note">
          {"Halves " + clock(h.first) + " / " + clock(h.second)}
          {shape ? ` · ${signed(h.delta_pct, 1)}% (${shape})` : null}
        </p>
      ) : null}
    </>
  );
}
